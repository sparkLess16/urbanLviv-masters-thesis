import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClusterExplorer from "./ClusterExplorer";
import * as clusterApi from "../services/clusterApi";

// Leaflet needs a real browser; the map is covered by the manual check.
jest.mock("./ClusterMap", () => ({ detail }) => (
  <div data-testid="map">{detail ? `zoomed:${detail.id}` : "city"}</div>
));
jest.mock("../services/clusterApi", () => ({
  fetchClusters: jest.fn(),
  fetchCluster: jest.fn(),
  fetchDistrictBorders: jest.fn(),
  fetchDistricts: jest.fn(),
  fetchTypes: jest.fn(),
}));
// react-router v7 does not resolve under CRA's Jest (App.test.js fails the same way).
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), {
  virtual: true,
});

const cluster = (overrides) => ({
  id: "c1",
  title: "Potholes along the tram line",
  type_id: "roads",
  district_id: "halytskyi",
  status: "active",
  reports_count: 4,
  in_progress_count: 1,
  responsible_service: "Department of Housing and Infrastructure",
  centroid: { lat: 49.84, lng: 24.03 },
  ...overrides,
});

const setup = () => {
  clusterApi.fetchDistricts.mockResolvedValue([
    { id: "halytskyi", name: "🏛 Halytskyi" },
  ]);
  clusterApi.fetchTypes.mockResolvedValue([{ id: "roads", name: "Roads" }]);
  clusterApi.fetchDistrictBorders.mockResolvedValue(null);
  clusterApi.fetchClusters.mockResolvedValue([
    cluster(),
    cluster({ id: "c2", title: "Broken bench", reports_count: 1 }),
  ]);
  clusterApi.fetchCluster.mockResolvedValue({ id: "c1", reports: [] });
  return render(<ClusterExplorer />);
};

afterEach(() => jest.resetAllMocks());

test("lists clusters with name, district, service and the summary", async () => {
  setup();
  expect(await screen.findByText("Potholes along the tram line")).toBeTruthy();
  expect(screen.getByText("2 clusters · 5 reports")).toBeTruthy();
  expect(screen.getAllByText("Halytskyi").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Handled by/).length).toBe(2);
  expect(clusterApi.fetchClusters).toHaveBeenCalledWith({
    district_id: "all",
    status: "open",
  });
});

test("changing the filters asks for the clusters again", async () => {
  setup();
  await screen.findByText("Potholes along the tram line");
  await userEvent.click(screen.getByLabelText("Status"));
  await userEvent.click(screen.getByRole("option", { name: "Resolved" }));
  await waitFor(() =>
    expect(clusterApi.fetchClusters).toHaveBeenLastCalledWith({
      district_id: "all",
      status: "resolved",
    }),
  );
});

test("selecting a cluster zooms the map and can be undone", async () => {
  setup();
  await userEvent.click(
    await screen.findByText("Potholes along the tram line"),
  );
  expect(await screen.findByText("zoomed:c1")).toBeTruthy();
  expect(clusterApi.fetchCluster).toHaveBeenCalledWith("c1");

  await userEvent.click(screen.getByText("Show all clusters"));
  expect(screen.getByTestId("map").textContent).toBe("city");
});

test("a failed load shows an error with a retry", async () => {
  setup();
  clusterApi.fetchClusters.mockRejectedValue(new Error("network"));
  await userEvent.click(screen.getByLabelText("Status"));
  await userEvent.click(screen.getByRole("option", { name: "Closed" }));
  expect(await screen.findByText(/Could not load clusters/)).toBeTruthy();
  expect(screen.getByText("Try again")).toBeTruthy();
});
