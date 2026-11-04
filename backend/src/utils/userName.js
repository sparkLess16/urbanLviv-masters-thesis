// Joins the old firstName and lastName into one display name.
export function mergeName({ firstName, lastName } = {}) {
  return [firstName, lastName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
}
