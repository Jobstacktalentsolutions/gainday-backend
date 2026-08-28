import { Embeddings } from '@langchain/core/embeddings';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';

export function taskContentToEmbeddingText(taskContent: QuestionBankTaskContent): string {
  return [taskContent.title, taskContent.scenarioDescription, taskContent.questionPrompt].join('\n\n');
}

export async function embedTaskContent(
  embeddings: Embeddings,
  taskContent: QuestionBankTaskContent,
): Promise<number[]> {
  return embeddings.embedQuery(taskContentToEmbeddingText(taskContent));
}
