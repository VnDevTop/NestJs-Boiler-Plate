import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Carries the current request id, so anything that logs during a request can
 * include it without being handed the request object. The logger and the
 * exception filters read it from here.
 */
interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** A request id is attacker supplied, so it is accepted only if it looks safe. */
export function sanitizeRequestId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  // Long enough for a UUID, short enough that a caller cannot smuggle a payload
  // into every log line. The charset is what makes it safe to print unescaped:
  // no newlines, no control characters, nothing to break a log parser's lines.
  if (!/^[A-Za-z0-9._:-]{8,64}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function generateRequestId(): string {
  return randomUUID();
}
