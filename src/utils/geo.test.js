import { distanceMeters, fanOutOverlapping, findDistrictAt } from "./geo";

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

const square = (id, x, y) => ({
  properties: { district_id: id },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y],
      ],
    ],
  },
});

test("finds the district that contains the point", () => {
  const features = [square("a", 0, 0), square("b", 2, 0)];
  expect(findDistrictAt({ lat: 0.5, lng: 2.5 }, features)).toBe("b");
  expect(findDistrictAt({ lat: 0.5, lng: 1.5 }, features)).toBeNull();
});

test("a hole in a polygon is not part of the district", () => {
  const ring = (x, y, size) => [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
  const features = [
    {
      properties: { district_id: "ring" },
      geometry: {
        type: "Polygon",
        coordinates: [ring(0, 0, 4), ring(1, 1, 2)],
      },
    },
  ];
  expect(findDistrictAt({ lat: 2, lng: 2 }, features)).toBeNull();
  expect(findDistrictAt({ lat: 0.5, lng: 0.5 }, features)).toBe("ring");
});
