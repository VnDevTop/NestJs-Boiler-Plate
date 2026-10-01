/**
 * Timing equalisation for endpoints that must not reveal whether an account
 * exists.
 */

/** Default floor, and jitter range, for an account-existence endpoint. */
export const TIMING_FLOOR_MS = 250;
export const TIMING_JITTER_MS = 50;

export interface PadOptions {
  /** When the request started, from `Date.now()`. */
  startedAt: number;
  /** Shortest acceptable total duration. */
  floorMs?: number;
  /** Extra random delay, 0 to this value, added to both outcomes equally. */
  jitterMs?: number;
  /** Injected so a test does not have to wait in real time. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected so a test can pin the random component. */
  random?: () => number;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Holds a response until a minimum duration has passed.
 *
 * Why this exists: `forgot-password` has to answer the same way whether or not an
 * account exists, and a matching message is not enough. The branch that issues a
 * token does more database work than the branch that does not, and that
 * difference is measurable over a network without any clever analysis: an
 * attacker sending a batch of guesses and sorting by response time finds the
 * registered addresses.
 *
 * Both outcomes therefore wait for the same floor. The jitter is added to both,
 * not only to the fast one, because jittering just the fast path would make the
 * two distributions differ in the other direction and still be separable.
 *
 * The floor is a mitigation, not a proof. It only holds while the real branch
 * stays under it: if issuing a token ever takes longer than `floorMs`, that
 * branch becomes the slow one and the padding no longer equalises anything. The
 * constant is therefore set well above the few round trips the real branch
 * costs, and a test asserts the gap stays under it.
 */
export async function padResponse(options: PadOptions): Promise<void> {
  const {
    startedAt,
    floorMs = TIMING_FLOOR_MS,
    jitterMs = TIMING_JITTER_MS,
    sleep = wait,
    random = Math.random,
  } = options;

  const elapsed = Date.now() - startedAt;
  const jitter = jitterMs > 0 ? Math.floor(random() * jitterMs) : 0;
  const remaining = floorMs + jitter - elapsed;

  if (remaining > 0) {
    await sleep(remaining);
  }
}
