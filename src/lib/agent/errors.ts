import { AuditUnavailableError } from '../db/audit';
import { SafetyLimitError } from '../security/controls';
import { TraceUnavailableError } from '../observability/errors';

export class ModelProviderError extends Error {}

export function providerFailure(error: unknown): ModelProviderError {
  if (error instanceof ModelProviderError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    return new ModelProviderError(
      'The AI response took too long. Please retry with a shorter payment question. Check the approval queue for any refund requests already created.',
      { cause: error },
    );
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (typeof status === 'number' && status >= 500)
    return new ModelProviderError(
      'The AI provider is temporarily unavailable. Please try again later. Check the approval queue for any refund requests already created.',
      { cause: error },
    );
  if (status === 429)
    return new ModelProviderError(
      'The AI provider’s request or token quota has been reached. Wait for the quota to reset or check your project limits, then try again. Check the approval queue for any refund requests already created.',
      { cause: error },
    );
  if (status === 401 || status === 403)
    return new ModelProviderError(
      'The AI provider rejected access. Check the selected provider’s API key, project eligibility, and model access. Check the approval queue for any refund requests already created.',
      { cause: error },
    );
  return new ModelProviderError(
    'The agent could not finish this investigation. Check the selected AI provider’s model access and connection, then try again. Check the approval queue for any refund requests already created.',
    { cause: error },
  );
}

export function agentFailureMessage(error: unknown) {
  return error instanceof AuditUnavailableError || error instanceof SafetyLimitError || error instanceof TraceUnavailableError
    ? error.message : providerFailure(error).message;
}
