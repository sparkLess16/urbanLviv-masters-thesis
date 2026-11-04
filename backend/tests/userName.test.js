import test from "node:test";
import assert from "node:assert/strict";
import { mergeName } from "../src/utils/userName.js";

test("joins first and last name", () => {
  assert.equal(
    mergeName({ firstName: "Ivan", lastName: "Petrenko" }),
    "Ivan Petrenko",
  );
});

test("skips a missing or blank part and trims", () => {
  assert.equal(mergeName({ firstName: " Ivan ", lastName: "" }), "Ivan");
  assert.equal(mergeName({ lastName: "Petrenko" }), "Petrenko");
});

test("returns an empty string when there is nothing", () => {
  assert.equal(mergeName({}), "");
  assert.equal(mergeName(), "");
});
