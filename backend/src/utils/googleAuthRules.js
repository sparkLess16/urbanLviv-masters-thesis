// Decides what to do with a verified Google ID-token payload (no I/O, easy to test).
// Returns { action: "reject" | "login" | "link" | "create", ... }.
export function decideGoogleSignIn({ payload, userByGoogleId, userByEmail }) {
  if (!payload?.sub || !payload?.email) {
    return { action: "reject", message: "Invalid Google token" };
  }

  if (userByGoogleId) {
    return { action: "login", user: userByGoogleId };
  }

  if (payload.email_verified !== true) {
    return { action: "reject", message: "Google email is not verified" };
  }

  if (!userByEmail) {
    return { action: "create" };
  }

  if (userByEmail.google_id && userByEmail.google_id !== payload.sub) {
    return {
      action: "reject",
      message: "This email is linked to a different Google account",
    };
  }

  // An unverified local account may have been registered by someone who does
  // not own the email, so its password must not survive the link.
  return {
    action: "link",
    user: userByEmail,
    resetPassword: !userByEmail.isVerified,
  };
}
