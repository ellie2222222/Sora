import { Injectable, Logger } from '@nestjs/common';

import {
  buildAiContext,
  executeWithGemini,
} from './intent-context.ts';
import type { LlmProvider, LlmReply, LlmRequest } from './llm-provider.ts';

/** Gemini reads the caller's wallet context and detects intent itself, in any of the app's languages. */
@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiLlmProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fallbackModel: string,
  ) {}

  // Chat text is the user's financial life in their own words, so only its shape is logged.
  async reply(request: LlmRequest): Promise<LlmReply> {
    const context = await buildAiContext(request);
    this.logger.debug(
      `Prompt for ${this.model} (fallback ${this.fallbackModel}): ${context.systemInstructions.length} chars, ${context.history.length} earlier messages, locale ${request.locale}`,
    );

    const reply = await executeWithGemini(context, request, {
      apiKey: this.apiKey,
      model: this.model,
      fallbackModel: this.fallbackModel,
    });

    this.logger.debug(`Reply: ${reply.content.length} chars${reply.proposal ? `, proposes a ${reply.proposal.transaction.type}` : ''}`);
    return reply;
  }
}

