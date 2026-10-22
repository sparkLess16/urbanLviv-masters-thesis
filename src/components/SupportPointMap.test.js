import { render, screen } from "@testing-library/react";

// A light fake of Leaflet (jsdom has no SVG renderer). It records the order of
// calls and, like the real library, fails when a circle's bounds are asked for
// before the map has a view. Plain functions: CRA resets jest.fn() mocks.
const mockCalls = [];
jest.mock("leaflet", () => {
  const layer = () => ({
    addTo() {
      return this;
    },
    on() {},
    getLatLng: () => ({ lat: 49.84, lng: 24.02 }),
    setLatLng() {},
  });
  return {
    __esModule: true,
    default: {
      map: () => ({
        fitBounds() {
          mockCalls.push("fitBounds");
        },
        remove() {},
      }),
      tileLayer: layer,
      latLng: () => ({
        toBounds() {
          mockCalls.push("toBounds");
          const bounds = {
            extend: () => bounds,
            pad: () => bounds,
          };
          return bounds;
        },
      }),
      circle: () => {
        mockCalls.push("circle");
        return {
          ...layer(),
          getBounds() {
            throw new Error("circle.getBounds needs a map view");
          },
        };
      },
      marker: layer,
      divIcon: () => ({}),
    },
  };
});

// eslint-disable-next-line import/first
import SupportPointMap from "./SupportPointMap";

test("the view is set before the circle is added, and getBounds is not used", () => {
  mockCalls.length = 0;
  render(
    <SupportPointMap
      origin={{ lat: 49.84493, lng: 24.024 }}
      value={{ lat: 49.8458, lng: 24.0241 }}
      onChange={() => {}}
    />,
  );

  expect(mockCalls).toEqual(["toBounds", "fitBounds", "circle"]);
  expect(screen.getByText(/Drag the blue pin/)).toBeInTheDocument();
});
