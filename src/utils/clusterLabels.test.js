import { markerSize, plainDistrictName, reportsLabel } from "./clusterLabels";

test("district emoji is dropped from the name", () => {
  expect(plainDistrictName("🏛 Halytskyi")).toBe("Halytskyi");
  expect(plainDistrictName("Halytskyi")).toBe("Halytskyi");
  expect(plainDistrictName(undefined)).toBe("");
});

test("report count is pluralised", () => {
  expect(reportsLabel(1)).toBe("1 report");
  expect(reportsLabel(4)).toBe("4 reports");
});

test("marker size grows with the count and stops at 10", () => {
  expect(markerSize(4)).toBeGreaterThan(markerSize(1));
  expect(markerSize(50)).toBe(markerSize(10));
});
