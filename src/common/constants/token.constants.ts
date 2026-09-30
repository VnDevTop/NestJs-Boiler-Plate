/**
 * Password reset and email verification token settings.
 *
 * The byte counts are entropy, not length: 32 bytes is 256 bits, so the token
 * cannot be guessed and does not need to be long enough for a human to type,
 * because the user pastes a link rather than reading a code.
 */

export const PASSWORD_RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

/**
 * A verification token lives longer than a reset token, because losing an
 * address on a signup is a dead end for the user while a reset link is a
 * request they can repeat.
 */
export const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;
