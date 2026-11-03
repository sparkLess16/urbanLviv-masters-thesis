import { distanceMeters, fanOutOverlapping } from "./geo";

const at = (lat, lng) => ({ lat, lng });

test("a lone report keeps its place", () => {
  const item = { point: at(49.84, 24.03) };
  const result = fanOutOverlapping([item], (i) => i.point);
  expect(result.get(item)).toEqual(item.point);
});

test("reports at the same spot are spread around it", () => {
  const items = [
    { point: at(49.84, 24.03) },
    { point: at(49.84, 24.03) },
    { point: at(49.84, 24.03) },
  ];
  const result = fanOutOverlapping(items, (i) => i.point, 14);
  const shown = items.map((item) => result.get(item));

  shown.forEach((point) => {
    expect(distanceMeters(point, items[0].point)).toBeCloseTo(14, 0);
  });
  expect(distanceMeters(shown[0], shown[1])).toBeGreaterThan(10);
  expect(distanceMeters(shown[1], shown[2])).toBeGreaterThan(10);
});

test("far apart reports are not touched", () => {
  const a = { point: at(49.84, 24.03) };
  const b = { point: at(49.85, 24.03) };
  const result = fanOutOverlapping([a, b], (i) => i.point);
  expect(result.get(a)).toEqual(a.point);
  expect(result.get(b)).toEqual(b.point);
});
