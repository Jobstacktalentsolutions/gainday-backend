import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import {
  CRITIC_MODEL,
  EMBEDDINGS,
  GENERATION_MODEL,
  TASK_GENERATION_MODEL,
} from './ai.constants';

/**
 * Groq has no embeddings API at all, so `ai.provider` only selects the chat model used for
 * GENERATION_MODEL/CRITIC_MODEL/TASK_GENERATION_MODEL — EMBEDDINGS always uses Gemini's
 * embedding model regardless (see the EMBEDDINGS provider below, which does not branch on
 * provider).
 */
function buildChatModel(
  config: ConfigService,
  role: 'generationModel' | 'criticModel' | 'taskGenerationModel',
  temperatureKey: 'ai.generationTemperature' | 'ai.criticTemperature',
): BaseChatModel {
  const provider = config.get<string>('ai.provider');
  if (provider === 'groq') {
    return new ChatGroq({
      apiKey: config.get<string>('ai.groq.apiKey'),
      model: config.getOrThrow<string>(`ai.groq.${role}`),
      temperature: config.get<number>(temperatureKey),
      // openai/gpt-oss-* models on Groq are reasoning models: by default they spend a large,
      // hidden "reasoning" token budget on every call, which counts against the same 8000 TPM
      // free-tier limit as visible input/output — this (not schema/prompt size) is what was
      // burning ~1400+ tokens per small structured-output call. 'low' cuts that budget sharply
      // while keeping some reasoning for correctness (vs. 'none', which drops it entirely).
      reasoningEffort: 'low',
    });
  }
  if (provider === 'gemini') {
    return new ChatGoogleGenerativeAI({
      apiKey: config.get<string>('ai.gemini.apiKey'),
      model: config.getOrThrow<string>(`ai.gemini.${role}`),
      temperature: config.get<number>(temperatureKey),
    });
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GENERATION_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseChatModel =>
        buildChatModel(config, 'generationModel', 'ai.generationTemperature'),
    },
    {
      provide: CRITIC_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseChatModel =>
        buildChatModel(config, 'criticModel', 'ai.criticTemperature'),
    },
    {
      provide: TASK_GENERATION_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseChatModel =>
        buildChatModel(
          config,
          'taskGenerationModel',
          'ai.generationTemperature',
        ),
    },
    {
      provide: EMBEDDINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Embeddings => {
        return new GoogleGenerativeAIEmbeddings({
          apiKey: config.get<string>('ai.gemini.apiKey'),
          model: config.getOrThrow<string>('ai.gemini.embeddingModel'),
        });
      },
    },
  ],
  exports: [GENERATION_MODEL, CRITIC_MODEL, TASK_GENERATION_MODEL, EMBEDDINGS],
})
export class AiModule {}
