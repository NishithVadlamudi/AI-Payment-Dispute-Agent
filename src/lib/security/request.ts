import 'server-only';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { MAX_REQUEST_BYTES } from './limits';

export class RequestBodyError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function readChatBody(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_REQUEST_BYTES)
    throw new RequestBodyError(413, 'That conversation is too large. Start a new chat or send a shorter message.');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, 'Send a valid JSON chat request.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestBodyError(413, 'That conversation is too large. Start a new chat or send a shorter message.');
      }
      chunks.push(next.value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, 'Send a valid JSON chat request.');
  } finally { reader.releaseLock(); }
}

export function requestBucket(request: Request) {
  // Vercel overwrites its forwarding headers. Other hosts must explicitly trust
  // a proxy which strips client-supplied headers. Never trust them by default.
  const trusted = process.env.VERCEL === '1' || process.env.TRUST_PROXY_HEADERS === 'true';
  const forwarded = trusted
    ? (process.env.VERCEL === '1'
      ? request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for')
      : request.headers.get('x-forwarded-for'))
    : null;
  const candidate = forwarded?.split(',')[0].trim();
  let address = candidate && isIP(candidate) ? candidate : 'shared-untrusted-origin';
  // Canonicalize IPv6 so equivalent spellings cannot create separate buckets.
  if (isIP(address) === 6) address = new URL(`http://[${address}]`).hostname;
  return createHash('sha256').update(address).digest('hex');
}
