// Tuned with `npm run eval:duplicates -- --split tune` on the tune half of the
// evaluation set (20 groups, 173 reports) and checked on the test half
// (radius 500 m, document-to-document cosine similarity), no type bonus.
//
// The thresholds apply to the similarity of the TEXTS only (alpha 1), plus a
// separate condition "within radiusM". They are not applied to the combined
// score: closeness lowers the combined score by up to 0.3, so a near copy 100 m
// away fell below the threshold and hints almost never appeared. Combined score
// is only used to order the hints (closer first).
//                tune: precision / recall    test: precision / recall
//   hint   0.850:   0.78 / 0.91                  0.78 / 0.81
//   dialog 0.900:   0.99 / 0.59                  0.96 / 0.56
// Same-language texts about different problems already have a cosine of about
// 0.8, so values below 0.85 would show everything nearby.
// The test recall of the hint is lower than on tune; 0.825 would keep 0.90 on
// test at the price of precision 0.73. A hint is only advice, so it stays at
// the value chosen on tune.
export const SUGGEST_SETTINGS = {
  // Reports whose text is less similar than this are not shown as hints.
  hintMinSemantic: 0.85,
  // At or above this similarity (and within dialogRadiusM) the submit dialog is shown.
  dialogMinSemantic: 0.9,
  // Hints are advice, so they may come from further away (the card shows the
  // distance). The dialog interrupts the person, so it needs a closer match:
  // another pothole 300 m down the street must not trigger it. 200 m is an
  // assumption: D0 has no real distances to tune it on, check it in step EV.
  radiusM: 500,
  dialogRadiusM: 200,
  limit: 3,
  // Shorter texts are not worth a paid embedding call.
  minTextLength: 20,
  snippetLength: 140,
};
