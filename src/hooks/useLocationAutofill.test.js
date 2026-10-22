import { renderHook, act } from "@testing-library/react";
import api from "../services/api";
import { useLocationAutofill } from "./useLocationAutofill";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const setup = () => {
  const setCoordinates = jest.fn();
  const setDistrictId = jest.fn();
  const setAddress = jest.fn();
  const view = renderHook(() =>
    useLocationAutofill({ setCoordinates, setDistrictId, setAddress }),
  );
  return { ...view, setCoordinates, setDistrictId, setAddress };
};

test("first click fills district and address", async () => {
  api.get.mockResolvedValueOnce({
    data: { display: "Rynok", district_id: "halytskyi" },
  });
  const { result, setDistrictId, setAddress } = setup();

  await act(() => result.current.pickPoint({ lat: 1, lng: 2 }));

  expect(setDistrictId).toHaveBeenCalledWith("halytskyi");
  expect(setAddress).toHaveBeenCalledWith("Rynok");
});

test("a map click replaces a manually typed address and updates the district", async () => {
  api.get.mockResolvedValueOnce({
    data: { display: "Stusa", district_id: "sykhivskyi" },
  });
  const { result, setDistrictId, setAddress } = setup();

  act(() => result.current.onLocationTyped());
  await act(() => result.current.pickPoint({ lat: 1, lng: 2 }));

  expect(setAddress).toHaveBeenCalledWith("Stusa");
  expect(setDistrictId).toHaveBeenCalledWith("sykhivskyi");
});

test("typed text stays when the geocoder finds no address for the point", async () => {
  api.get.mockResolvedValueOnce({
    data: { display: null, district_id: "halytskyi" },
  });
  const { result, setDistrictId, setAddress } = setup();

  await act(() => result.current.pickPoint({ lat: 1, lng: 2 }));

  expect(setAddress).not.toHaveBeenCalled();
  expect(setDistrictId).toHaveBeenCalledWith("halytskyi");
});

test("typed address moves the point and district, text stays untouched", async () => {
  api.get.mockResolvedValueOnce({
    data: { found: true, lat: 49.8, lng: 24.0, district_id: "frankivskyi" },
  });
  const { result, setCoordinates, setDistrictId, setAddress } = setup();

  act(() => result.current.onLocationTyped());
  await act(() => result.current.searchAddress("15 Zelena Street"));

  expect(setCoordinates).toHaveBeenCalledWith({ lat: 49.8, lng: 24.0 });
  expect(setDistrictId).toHaveBeenCalledWith("frankivskyi");
  expect(setAddress).not.toHaveBeenCalled();
});

test("address not found changes nothing and shows a hint", async () => {
  api.get.mockResolvedValueOnce({ data: { found: false } });
  const { result, setCoordinates, setDistrictId } = setup();

  act(() => result.current.onLocationTyped());
  await act(() => result.current.searchAddress("nowhere 999"));

  expect(setCoordinates).not.toHaveBeenCalled();
  expect(setDistrictId).not.toHaveBeenCalled();
  expect(result.current.hint).toMatch(/not found/i);
});

test("no search when the text was not typed since the last search", async () => {
  api.get.mockClear();
  const { result } = setup();

  await act(() => result.current.searchAddress("15 Zelena Street"));

  expect(api.get).not.toHaveBeenCalled();
});

test("a map click that follows the typing wins over the search", async () => {
  let resolveSearch;
  api.get.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSearch = resolve;
    }),
  );
  api.get.mockResolvedValueOnce({
    data: { display: "Clicked", district_id: "sykhivskyi" },
  });
  const { result, setCoordinates, setDistrictId } = setup();

  act(() => result.current.onLocationTyped());
  let search;
  act(() => {
    search = result.current.searchAddress("15 Zelena Street");
  });
  await act(() => result.current.pickPoint({ lat: 1, lng: 2 }));
  await act(async () => {
    resolveSearch({
      data: { found: true, lat: 9, lng: 9, district_id: "halytskyi" },
    });
    await search;
  });

  expect(setCoordinates).toHaveBeenCalledTimes(1);
  expect(setCoordinates).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  expect(setDistrictId).toHaveBeenCalledTimes(1);
  expect(setDistrictId).toHaveBeenCalledWith("sykhivskyi");
});
