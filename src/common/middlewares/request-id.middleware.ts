import { Injectable, type NestMiddleware } from '@nestjs/common';

import { REQUEST_ID_HEADER } from '../constants/index.js';
import {
  generateRequestId,
  runWithRequestId,
  sanitizeRequestId,
} from '../utils/index.js';

/**
 * Only the parts of the exchange this middleware touches, declared here because
 * Express and Fastify share no request or reply type, and importing either one
 * would tie the middleware to that platform.
 */
export interface RequestWithHeaders {
  headers: Record<string, unknown>;
}

export interface ReplyWithHeader {
  /** Express and Fastify both have this. */
  header?(name: string, value: string): unknown;
  /** Express only, and the one used by Node's own response object. */
  setHeader?(name: string, value: string): unknown;
}

/**
 * Gives every request an id, reusing the caller's when it is safe to do so, so
 * one identifier follows a request across services, a proxy and the logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithHeaders, res: ReplyWithHeader, next: () => void): void {
    const requestId =
      sanitizeRequestId(req.headers[REQUEST_ID_HEADER]) ?? generateRequestId();

    // `header` is the one spelling both platforms share: Express aliases it to
    // `set`, and Fastify has no `setHeader` at all. If neither is present the
    // request still gets an id in the logs through the context below, so this
    // is a best effort rather than a requirement.
    if (res.header) {
      res.header(REQUEST_ID_HEADER, requestId);
    } else {
      res.setHeader?.(REQUEST_ID_HEADER, requestId);
    }

    // Everything downstream runs inside this, including code that never sees the
    // request object, such as a service that logs.
    runWithRequestId(requestId, () => next());
  }
}
