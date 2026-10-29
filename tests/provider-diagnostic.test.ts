import { describe, expect, it } from 'vitest';
import { providerDiagnostic } from '../src/lib/agent/errors';

describe('sanitized provider diagnostics', () => {
  it.each([[503, 'upstream_server'], [500, 'upstream_server'], [429, 'quota'], [403, 'access'], [400, 'request']])('classifies HTTP %s without retaining raw payloads', (status, category) => {
    const result = providerDiagnostic({ status, message: 'PRIVATE_KEY and customer prompt', url: 'https://example.invalid/?key=PRIVATE_KEY', headers: { authorization: 'PRIVATE_KEY' } });
    expect(result).toEqual({ category, http_status: status });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_KEY');
  });
  it('finds status through a wrapped provider exception', () => {
    expect(providerDiagnostic(new Error('safe wrapper', { cause: { status: 503, body: 'private' } }))).toEqual({ category: 'upstream_server', http_status: 503 });
  });
  it('distinguishes network and certificate failures using only known codes', () => {
    expect(providerDiagnostic(new Error('fetch failed', { cause: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' } }))).toEqual({ category: 'network_or_tls', http_status: null, network_code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    expect(providerDiagnostic({ code: 'PRIVATE_KEY', status: '503' })).toEqual({ category: 'unknown', http_status: null });
  });
  it('handles circular causes without retaining error contents', () => {
    const error: { cause?: unknown } = {}; error.cause = error;
    expect(providerDiagnostic(error)).toEqual({ category: 'unknown', http_status: null });
  });
});
