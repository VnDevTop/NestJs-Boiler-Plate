import { createHash } from 'node:crypto';

/**
 * The identity a deduplication guard uses to decide whether two enqueues are the
 * same work.
 *
 * The shape is built here rather than at each call site on purpose. A guard only
 * works if every caller produces the same string for the same intent, and a
 * caller that hand-rolls it produces a slightly different string, and then the
 * guard silently stops guarding.
 */

export interface DedupeSubject {
  /** Template name, so two different mails to one address are not one job. */
  template: string;
  /** Recipient, lowercased by the builder. */
  to: string;
  /**
   * What distinguishes two otherwise identical mails, such as a job id or a
   * timestamp. Without it, asking for two reset mails in a minute is one job and
   * the user gets one link.
   */
  subjectId: string;
}

/**
 * The raw key, before any namespace prefix.
 *
 * Hashed because a recipient is personal data and this string ends up in redis,
 * in a `KEYS` listing during an incident, and in a dead-letter entry. The hash
 * keeps the key fixed width, which matters because the whole point is that it is
 * looked up on every delivery.
 */
export function dedupeKey(subject: DedupeSubject): string {
  // JSON rather than `join('|')`: a separator is only unambiguous if no field can
  // contain it, and the alternative is that one unusual recipient makes two
  // different jobs collide, which is a silent failure of the guard itself.
  const canonical = JSON.stringify([
    subject.template,
    subject.to.trim().toLowerCase(),
    subject.subjectId,
  ]);

  return `dedupe:${createHash('sha256').update(canonical).digest('hex')}`;
}
