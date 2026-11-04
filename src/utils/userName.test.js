import { getUserName } from "./userName";

test("uses the merged name", () => {
  expect(getUserName({ name: "Ivan Petrenko" })).toBe("Ivan Petrenko");
});

test("falls back to the old first and last name", () => {
  expect(getUserName({ firstName: "Ivan", lastName: "Petrenko" })).toBe(
    "Ivan Petrenko",
  );
  expect(getUserName({ firstName: "Ivan" })).toBe("Ivan");
});

test("returns an empty string without a user", () => {
  expect(getUserName(null)).toBe("");
  expect(getUserName({})).toBe("");
});
