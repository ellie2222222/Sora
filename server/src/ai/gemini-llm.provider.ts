import { Injectable, Logger } from '@nestjs/common';

import {
  buildAiContext,
  executeWithGemini,
} from './intent-context.ts';
import type { LlmProvider, LlmReply, LlmRequest } from './llm-provider.ts';
import { MockLlmProvider } from './mock-llm.provider.ts';

/**
 * Real Google Gemini LLM Provider.
 * Assembles full authorized financial context and lets Google Gemini detect user intent
 * and formulate responses/proposals natively across all supported languages.
 */
@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiLlmProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-3.8-flash',
    private readonly fallbackModel: string = 'gemini-3.1-flash-lite',
  ) {}

  async reply(request: LlmRequest): Promise<LlmReply> {
    this.logger.log(`[AI Request] User message: "${request.message}" (locale: ${request.locale})`);

    this.logger.log(`[Construct Prompt] Assembling full wallet context and financial data...`);
    const context = await buildAiContext(request);
    this.logger.log(
      `[Constructed Prompt] Target model: ${this.model} (fallback: ${this.fallbackModel}) | System instructions: ${context.systemInstructions.length} chars | History count: ${context.history.length}`,
    );

    this.logger.log(`[Execute Gemini] Invoking model to detect intent and generate response...`);
    const reply = await executeWithGemini(
      context,
      request,
      {
        apiKey: this.apiKey,
        model: this.model,
        fallbackModel: this.fallbackModel,
      },
      () => new MockLlmProvider().reply(request),
    );

    this.logger.log(
      `[Return Response] Content: "${reply.content}"${reply.proposal ? ` | Proposal: ${JSON.stringify(reply.proposal)}` : ''}`,
    );

    return reply;
  }
}

