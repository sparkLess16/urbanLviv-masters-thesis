// "🌳 Frankivskyi" -> "Frankivskyi": the district labels carry an emoji that
// the report views do not show.
export const stripLeadingEmoji = (text = "") =>
  text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "");
