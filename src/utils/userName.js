// Display name of a stored user. Falls back to the old firstName/lastName
// for sessions saved in localStorage before the fields were merged.
export function getUserName(user) {
  if (!user) return "";
  return (
    user.name || [user.firstName, user.lastName].filter(Boolean).join(" ")
  ).trim();
}
