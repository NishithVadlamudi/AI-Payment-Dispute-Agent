import { ModelProviderError, agentFailureMessage } from '../agent/errors';
import { SafetyLimitError } from '../security/controls';

// Do not spend more reservations on a provider-wide failure. Case-specific
// response/content errors still run the next case; guard cases never need a model.
export function evalBlockReason(error: unknown): string | null {
  if (error instanceof SafetyLimitError && error.status === 429 && !error.retryAfter)
    return agentFailureMessage(error);
  if (error instanceof ModelProviderError) {
    const cause = error.cause;
    const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
    if (typeof status === 'number' && ([401, 403, 429].includes(status) || status >= 500))
      return agentFailureMessage(error);
  }
  return null;
}
