import { Inject, Injectable } from '@nestjs/common';

import { CONFIG, type AppConfig } from '../../config/env.ts';
import type { Intent } from '../interfaces/intent.interface.ts';

export type ModelTask = 'intent' | 'chat' | 'analysis' | 'complex';

@Injectable()
export class ModelRouterService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  getModel(task: ModelTask): string {
    const keyByTask: Record<ModelTask, keyof AppConfig> = {
      intent: 'GEMINI_MODEL_INTENT',
      chat: 'GEMINI_MODEL_CHAT',
      analysis: 'GEMINI_MODEL_ANALYSIS',
      complex: 'GEMINI_MODEL_COMPLEX',
    };
    const key = keyByTask[task];
    const model = this.config[key] || this.config.GEMINI_MODEL;
    if (!model || typeof model !== 'string') {
      throw new Error(`Missing model configuration: ${key}`);
    }
    return model;
  }
}

/**
 * Routes the appropriate model task based on the detected intent.
 * Initial configuration maps analysis to the same fast Flash model as intent,
 * reserving complex reasoning models for financial advisory.
 */
export function selectTask(intent: Intent): ModelTask {
  switch (intent.intent) {
    case 'general_chat':
    case 'clarification_needed':
      return 'chat';
    case 'financial_advice':
      return 'complex';
    case 'spending_summary':
    case 'income_summary':
    case 'cash_flow_summary':
    case 'category_breakdown':
    case 'budget_status':
    case 'goal_status':
    case 'transaction_search':
      return 'analysis';
    default:
      return 'intent';
  }
}

