import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { DrizzleDb } from '../../../db/client';
import { RoleRegistry } from '../roles/role-registry';

export interface GenerationConfig {
  candidatePoolSize: number;
  selectedTaskCount: number;
  maxCriticAttempts: number;
  duplicateSimilarityThreshold: number;
  noveltyCheckTopK: number;
  anchorScorePoints: number[];
}

/**
 * Plain context object threaded through every graph node (nodes are plain functions per
 * LangGraph's API, not NestJS-injectable classes). Built once per graph invocation by
 * GenerationService from injected NestJS providers.
 */
export interface GenerationContext {
  generationModel: BaseChatModel;
  criticModel: BaseChatModel;
  embeddings: Embeddings;
  db: DrizzleDb;
  roleRegistry: RoleRegistry;
  config: GenerationConfig;
}
