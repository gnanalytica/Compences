/**
 * Which sign-in methods the app offers.
 *
 * The pilot uses Google only. Email magic links are switched off here rather
 * than removed: `signInWithEmail` and the auth callback still handle them, so
 * turning this back on is a one-line change. Supabase's Email provider is
 * still enabled server-side.
 */
export const EMAIL_SIGN_IN_ENABLED = false;

/**
 * Email and password, for the test account the stores' reviewers are given.
 *
 * Nobody can make a password in the app: there is no sign-up form and no
 * "forgot password". An account has one only if it was set by hand in
 * Supabase, which is done for the reviewers' test account and nobody else.
 * Play's reviewers cannot sign in with a Google account of their own, and the
 * alternative was handing them the password to somebody's real one.
 *
 * It sits behind a small link on the sign-in screen, so a resident is not
 * shown a password field for a password they do not have.
 */
export const PASSWORD_SIGN_IN_ENABLED = true;
