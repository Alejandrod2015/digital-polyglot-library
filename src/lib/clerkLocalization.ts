// Overrides for the handful of Clerk strings whose default wording leaves the
// user stuck. Everything not listed here keeps Clerk's own English copy.
//
// WHY (2026-09-04): signing up with an email that already has an account
// answered "That email address is taken. Please try another." That reads as
// "pick a different email", which is the opposite of what the person needs to
// do: they already have the account, they just have to sign in. The new copy
// names the way out, and the "Sign in" link it points at is already sitting at
// the bottom of the same card.
export const clerkLocalization = {
  unstable__errors: {
    form_identifier_exists:
      'You already have an account with this email. Use the "Sign in" link below instead.',
    form_identifier_exists__email_address:
      'You already have an account with this email. Use the "Sign in" link below instead.',
  },
};
