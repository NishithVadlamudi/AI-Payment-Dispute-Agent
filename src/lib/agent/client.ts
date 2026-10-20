import 'server-only';
import { ConfigurationError } from '../db/client';
import { createGeminiClient } from './providers/gemini';
import { createOpenAIClient } from './providers/openai';
import type { ModelClient } from './types';

export type { ModelClient, ModelEvent, ModelInput, ModelOutput, ModelRequest } from './types';

export function createModelClient(): ModelClient {
  const provider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  if (provider === 'gemini') return createGeminiClient();
  if (provider === 'openai') return createOpenAIClient();
  throw new ConfigurationError('Unsupported AI_PROVIDER. Choose gemini (default) or openai.');
}
