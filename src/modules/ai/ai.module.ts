import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { CRITIC_MODEL, EMBEDDINGS, GENERATION_MODEL } from './ai.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GENERATION_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseChatModel => {
        const provider = config.get<string>('ai.provider');
        if (provider !== 'gemini') {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
        return new ChatGoogleGenerativeAI({
          apiKey: config.get<string>('ai.gemini.apiKey'),
          model: config.getOrThrow<string>('ai.gemini.generationModel'),
          temperature: config.get<number>('ai.generationTemperature'),
        });
      },
    },
    {
      provide: CRITIC_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseChatModel => {
        const provider = config.get<string>('ai.provider');
        if (provider !== 'gemini') {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
        return new ChatGoogleGenerativeAI({
          apiKey: config.get<string>('ai.gemini.apiKey'),
          model: config.getOrThrow<string>('ai.gemini.criticModel'),
          temperature: config.get<number>('ai.criticTemperature'),
        });
      },
    },
    {
      provide: EMBEDDINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Embeddings => {
        const provider = config.get<string>('ai.provider');
        if (provider !== 'gemini') {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
        return new GoogleGenerativeAIEmbeddings({
          apiKey: config.get<string>('ai.gemini.apiKey'),
          model: config.getOrThrow<string>('ai.gemini.embeddingModel'),
        });
      },
    },
  ],
  exports: [GENERATION_MODEL, CRITIC_MODEL, EMBEDDINGS],
})
export class AiModule {}
