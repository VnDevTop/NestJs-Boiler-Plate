/**
 * What asked for a retention run.
 *
 * Stored as a string rather than a database enum because the admin route is the
 * only other writer, and a new source means an application deploy rather than a
 * migration. `manual` covers a person at a terminal or a script; `admin` covers
 * the HTTP route, which is worth telling apart when the two disagree about how
 * often they are used.
 */
export enum RetentionTrigger {
  Cron = 'cron',
  Manual = 'manual',
  Admin = 'admin',
}
