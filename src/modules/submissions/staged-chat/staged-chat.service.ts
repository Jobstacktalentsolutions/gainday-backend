import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../db/db.constants';
import type { DrizzleDb } from '../../../db/client';
import {
  questionBank,
  simulations,
  submissions,
  type SimulationTask,
  type StagedChatRecord,
  type Submission,
} from '../../../db/schema';
import {
  INTERFACE_SCHEMAS,
  InterfaceType,
  type StagedChatPayload,
} from '../../generation/roles/interface-type';
import {
  stagedChatEnvelopeSchema,
  type StagedChatServerData,
} from '../../generation/roles/customer-service/staged-chat/staged-script';
import { BRANCH_EVALUATOR, type BranchEvaluator } from './branch-evaluator';
import {
  buildTranscript,
  decideReply,
  releasedMessage,
  replyProblem,
  type ReleasedMessage,
  type StagedReply,
  type TranscriptEntry,
} from './staged-chat.engine';

export interface StagedChatTranscriptEntry {
  turn: number;
  customerMessage: string;
  typingDelayMs: number;
  candidateReply: string | null;
  /** When the server stored the candidate reply. Null while the reply is still to be written. */
  candidateSentAt: string | null;
}

export interface StagedChatState {
  taskId: string;
  displayName: string;
  caseFile: StagedChatPayload['caseFile'];
  wordLimit: StagedChatPayload['wordLimit'];
  turnCount: number;
  placeholder: string | null;
  status: StagedChatRecord['status'];
  /** The turn the candidate answers next. It reads past the turn count once the chat is complete. */
  currentTurn: number;
  /** Released messages only: every answered turn, plus the message currently on screen. */
  transcript: StagedChatTranscriptEntry[];
}

export interface PostReplyInput {
  turn: number;
  text: string;
  clientSentAt: Date | null;
  idempotencyKey: string;
}

export interface PostReplyResponse {
  turn: number;
  completed: boolean;
  nextCustomerMessage: ReleasedMessage | null;
  currentTurn: number;
  turnCount: number;
}

/** What the grading pipeline consumes for one staged chat. Checkpoints are server-only. */
export interface FinishedStagedChat {
  taskId: string;
  questionBankId: string;
  status: StagedChatRecord['status'];
  transcript: TranscriptEntry[];
  turns: { turn: number; checkpoints: string[]; criticalErrors: string[] }[];
}

interface StagedTask {
  questionBankId: string;
  payload: StagedChatPayload;
}

@Injectable()
export class StagedChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(BRANCH_EVALUATOR) private readonly branchEvaluator: BranchEvaluator,
  ) {}

  assertOwned(submission: Submission | null | undefined, profileId: string): Submission {
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.candidateId !== profileId) {
      throw new ForbiddenException('This submission does not belong to you');
    }
    return submission;
  }

  /** The visible state of one staged chat. Only released messages are included, never a future one. */
  async getState(submission: Submission, taskId: string): Promise<StagedChatState> {
    const task = await this.loadTask(submission, taskId);
    const script = await this.loadScript(task.questionBankId);
    const record = recordFor(submission.stagedChats, taskId);
    const replies = record.replies;

    const transcript: StagedChatTranscriptEntry[] = replies.map((reply) => ({
      turn: reply.turnIndex,
      customerMessage: reply.customerMessage,
      typingDelayMs: releasedMessage(script, reply.turnIndex, reply.branchId).typingDelayMs,
      candidateReply: reply.candidateText,
      candidateSentAt: reply.serverReceivedAt,
    }));

    const currentTurn = replies.length + 1;
    if (record.status === 'IN_PROGRESS' && currentTurn <= task.payload.turnCount) {
      const released = releasedMessage(script, currentTurn, branchFor(replies, currentTurn));
      transcript.push({
        turn: currentTurn,
        customerMessage: released.message,
        typingDelayMs: released.typingDelayMs,
        candidateReply: null,
        candidateSentAt: null,
      });
    }

    return {
      taskId,
      displayName: task.payload.displayName,
      caseFile: task.payload.caseFile,
      wordLimit: task.payload.wordLimit,
      turnCount: task.payload.turnCount,
      placeholder: task.payload.placeholder,
      status: record.status,
      currentTurn,
      transcript,
    };
  }

  /**
   * Stores one reply and releases the next customer message. The submission row is locked for the
   * whole check-and-write, so two requests for the same turn run one after the other: the second
   * sees the first reply and either replays it (same idempotency key) or conflicts.
   */
  async postReply(submission: Submission, taskId: string, input: PostReplyInput): Promise<PostReplyResponse> {
    const task = await this.loadTask(submission, taskId);
    const { turnCount, wordLimit } = task.payload;
    const script = await this.loadScript(task.questionBankId);

    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ stagedChats: submissions.stagedChats, completedAt: submissions.completedAt })
        .from(submissions)
        .where(eq(submissions.id, submission.id))
        .for('update');
      if (!locked) throw new NotFoundException('Submission not found');

      const record = recordFor(locked.stagedChats, taskId);
      const replies = record.replies;

      const decision = decideReply({
        turn: input.turn,
        idempotencyKey: input.idempotencyKey,
        currentTurn: replies.length + 1,
        sessionOpen: record.status === 'IN_PROGRESS' && locked.completedAt === null,
        existing: replies.find((reply) => reply.turnIndex === input.turn) ?? null,
      });

      switch (decision.kind) {
        case 'replay':
          return responseFor(decision.reply, script, turnCount);
        case 'conflict':
          throw new ConflictException(`Turn ${input.turn} already has a different reply`);
        case 'closed':
          throw new ConflictException('This staged chat is closed');
        case 'stale':
          throw new ConflictException({
            message: `Turn ${input.turn} is not the current turn`,
            currentTurn: decision.currentTurn,
          });
        case 'accept':
          break;
      }

      const problem = replyProblem(input.text, wordLimit);
      if (problem === 'EMPTY') throw new BadRequestException('The reply is empty');
      if (problem === 'TOO_LONG') {
        throw new BadRequestException(`The reply is over the ${wordLimit.max}-word limit`);
      }

      const branchId = branchFor(replies, input.turn);
      const nextBranchId =
        input.turn < turnCount ? this.branchEvaluator.evaluate({ turn: input.turn, reply: input.text }) : null;
      if (nextBranchId !== null && !script.branches.some((b) => b.id === nextBranchId && b.turn === input.turn + 1)) {
        throw new Error(`the branch evaluator returned "${nextBranchId}", which does not apply to turn ${input.turn + 1}`);
      }

      const stored: StagedReply & { clientSentAt: string | null; serverReceivedAt: string } = {
        turnIndex: input.turn,
        customerMessage: releasedMessage(script, input.turn, branchId).message,
        branchId,
        nextBranchId,
        candidateText: input.text,
        idempotencyKey: input.idempotencyKey,
        clientSentAt: input.clientSentAt === null ? null : input.clientSentAt.toISOString(),
        serverReceivedAt: new Date().toISOString(),
      };

      const nextRecord: StagedChatRecord = {
        ...record,
        status: input.turn === turnCount ? 'COMPLETE' : record.status,
        replies: [...replies, stored],
      };
      await tx
        .update(submissions)
        .set({ stagedChats: withRecord(locked.stagedChats, nextRecord), updatedAt: new Date() })
        .where(eq(submissions.id, submission.id));

      return responseFor(stored, script, turnCount);
    });
  }

  /** Called when the submission closes. Open chats keep their stored replies and are marked incomplete. */
  async markOpenSessionsIncomplete(submissionId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ stagedChats: submissions.stagedChats })
        .from(submissions)
        .where(eq(submissions.id, submissionId))
        .for('update');
      if (!locked) return;
      const updated = locked.stagedChats.map((record): StagedChatRecord =>
        record.status === 'IN_PROGRESS' ? { ...record, status: 'INCOMPLETE' } : record,
      );
      await tx
        .update(submissions)
        .set({ stagedChats: updated, updatedAt: new Date() })
        .where(eq(submissions.id, submissionId));
    });
  }

  /** The finished transcript and the server-only checkpoints, for the grading pipeline to consume. */
  async getFinishedTranscript(submission: Submission, taskId: string): Promise<FinishedStagedChat> {
    const task = await this.loadTask(submission, taskId);
    const script = await this.loadScript(task.questionBankId);
    const record = recordFor(submission.stagedChats, taskId);

    return {
      taskId,
      questionBankId: task.questionBankId,
      status: record.status,
      transcript: buildTranscript(record.replies),
      turns: script.turns.map((turn, index) => ({
        turn: index + 1,
        checkpoints: turn.checkpoints,
        criticalErrors: turn.criticalErrors,
      })),
    };
  }

  /** The simulation task for this id, checked to be a staged chat. The payload is re-validated. */
  private async loadTask(submission: Submission, taskId: string): Promise<StagedTask> {
    const simulation = await this.db.query.simulations.findFirst({
      where: eq(simulations.id, submission.simulationId),
    });
    if (!simulation) throw new NotFoundException('Simulation not found');

    const task: SimulationTask | undefined = simulation.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new NotFoundException('Task not found in this simulation');
    if (task.interfaceType !== InterfaceType.STAGED_CHAT) {
      throw new BadRequestException('This task is not a staged chat');
    }
    if (task.questionBankId === null) {
      throw new NotFoundException('This staged chat has no stored script');
    }
    return {
      questionBankId: task.questionBankId,
      payload: INTERFACE_SCHEMAS[InterfaceType.STAGED_CHAT].parse(task.interfacePayload),
    };
  }

  /** The server-only script, parsed from the question-bank row's task content. */
  private async loadScript(questionBankId: string): Promise<StagedChatServerData> {
    const [row] = await this.db.select().from(questionBank).where(eq(questionBank.id, questionBankId));
    if (!row) throw new NotFoundException('The staged chat script is missing');
    const serverOnly = row.taskContent.serverOnly;
    if (!serverOnly) throw new NotFoundException('The staged chat script is missing');
    return stagedChatEnvelopeSchema.parse(serverOnly).stagedChat;
  }
}

/** The record for a task, or an empty one when the candidate has not started that chat yet. */
function recordFor(chats: StagedChatRecord[], taskId: string): StagedChatRecord {
  const found = chats.find((record) => record.taskId === taskId);
  return found ?? { taskId, status: 'IN_PROGRESS', replies: [] };
}

/** The chats with one record replaced, or added when it is new. */
function withRecord(chats: StagedChatRecord[], next: StagedChatRecord): StagedChatRecord[] {
  const others = chats.filter((record) => record.taskId !== next.taskId);
  return [...others, next];
}

/** The branch that changed this turn's customer message: the one chosen after the previous reply. */
function branchFor(replies: StagedReply[], turn: number): string | null {
  const previous = replies.find((reply) => reply.turnIndex === turn - 1);
  return previous ? previous.nextBranchId : null;
}

function responseFor(reply: StagedReply, script: StagedChatServerData, turnCount: number): PostReplyResponse {
  const completed = reply.turnIndex === turnCount;
  return {
    turn: reply.turnIndex,
    completed,
    nextCustomerMessage: completed ? null : releasedMessage(script, reply.turnIndex + 1, reply.nextBranchId),
    currentTurn: reply.turnIndex + 1,
    turnCount,
  };
}
