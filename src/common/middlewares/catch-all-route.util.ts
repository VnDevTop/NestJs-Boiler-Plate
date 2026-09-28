import type { HttpServer } from '@nestjs/common';

/**
 * The catch-all route pattern the given platform understands.
 *
 * The two spellings are not interchangeable. path-to-regexp v8, behind Express 5,
 * treats a bare `*` as the removed repeating-parameter syntax and only logs a
 * warning before auto-converting it, so the named form is used there. find-my-way,
 * behind Fastify, expects the bare star and has no named equivalent. Picking the
 * wrong one either warns on every request or silently matches nothing.
 */
export function catchAllRoute(adapter: HttpServer): string {
  return adapter.getType() === 'fastify' ? '/*' : '{*path}';
}
