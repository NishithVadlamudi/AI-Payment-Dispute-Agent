import type { ModelUsage } from '../observability/schemas';
import type { Content } from '@google/genai';
import type { ResponseOutputItem } from 'openai/resources/responses/responses';

export type AgentTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};
export type ModelCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
  provider_call_id?: string;
};
// Native context stays server-side so signatures and reasoning state survive tool turns.
export type ModelContext =
  | { type: 'provider_context'; provider: 'gemini'; content: Content }
  | { type: 'provider_context'; provider: 'openai'; output: ResponseOutputItem[] };
export type ModelOutput = ModelCall | ModelContext;
export type ModelInput =
  | { type?: 'message'; role: 'user' | 'assistant'; content: string }
  | ModelOutput
  | { type: 'function_call_output'; call_id: string; output: string };
export type ModelEvent =
  { type: 'text'; text: string } | { type: 'completed'; output: ModelOutput[]; usage?: ModelUsage; resolvedModel?: string };
export type ModelRequest = {
  instructions: string;
  input: ModelInput[];
  tools: AgentTool[];
  signal?: AbortSignal;
};
export interface ModelClient {
  model: string;
  turn(request: ModelRequest): AsyncIterable<ModelEvent>;
}
