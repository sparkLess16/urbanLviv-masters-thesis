export const PRIORITY_WEIGHT = { critical: 40, high: 30, medium: 20, low: 10 };

// Starting weight of one supporter, to be tuned later (EV).
export const SUPPORT_WEIGHT = 3;

// Score for the Top-5 list: priority + likes·2 − dislikes + comments, plus
// SUPPORT_WEIGHT per supporter. `comments` counts text comments only: a support
// is not a comment, it is counted once, in `supports`.
export const computeTopScore = ({
  priorityId,
  likes = 0,
  dislikes = 0,
  comments = 0,
  supports = 0,
}) =>
  (PRIORITY_WEIGHT[priorityId] || 0) +
  likes * 2 -
  dislikes +
  comments +
  supports * SUPPORT_WEIGHT;
