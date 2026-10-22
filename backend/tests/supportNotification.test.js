import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTER_NOTIFICATION_TITLE,
  getSupporterNotificationText,
} from "../src/utils/notificationText.js";

test("each real status change has its own text with the report title", () => {
  const texts = ["in_progress", "resolved", "rejected", "cancelled"].map(
    (status) => getSupporterNotificationText(status, "Pothole"),
  );
  for (const text of texts) {
    assert.match(text, /you support/);
    assert.match(text, /"Pothole"/);
  }
  assert.equal(new Set(texts).size, 4);
});

test("a new report gives supporters no notification", () => {
  assert.equal(getSupporterNotificationText("new", "Pothole"), null);
});

test("an unknown status still gives a neutral text", () => {
  assert.match(
    getSupporterNotificationText("something", "Pothole"),
    /has been updated/,
  );
});

test("the notification title tells it is about a supported report", () => {
  assert.match(SUPPORTER_NOTIFICATION_TITLE, /support/);
});
