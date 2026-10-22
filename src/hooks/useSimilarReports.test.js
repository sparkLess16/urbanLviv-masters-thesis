import { renderHook, act } from "@testing-library/react";
import { suggestReports } from "../services/supportApi";
import {
  MIN_TEXT_CHANGE,
  PAUSE_MS,
  useSimilarReports,
} from "./useSimilarReports";

jest.mock("../services/supportApi", () => ({ suggestReports: jest.fn() }));

const point = { lat: 49.84, lng: 24.03 };
const item = (id) => ({ reportId: id, title: id, strong_match: false });

const render = (initial) =>
  renderHook((props) => useSimilarReports(props), { initialProps: initial });

const props = (description, coordinates = point, title = "") => ({
  title,
  description,
  coordinates,
});

const flush = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  suggestReports.mockReset();
  suggestReports.mockResolvedValue({ items: [item("a")] });
});

afterEach(() => {
  jest.useRealTimers();
});

test("one request after a pause, not one per keystroke", async () => {
  const text = "Big pothole on Zelena street near house 15";
  const { rerender } = render(props(""));

  for (let length = 1; length <= text.length; length += 1) {
    rerender(props(text.slice(0, length)));
    await flush(100);
  }
  expect(suggestReports).not.toHaveBeenCalled();

  await flush(PAUSE_MS);
  expect(suggestReports).toHaveBeenCalledTimes(1);
});

test("short text and a missing point cause no request", async () => {
  const { rerender } = render(props("short"));
  await flush(PAUSE_MS + 100);
  rerender(props("A long enough text for hints, yes", null));
  await flush(PAUSE_MS + 100);
  expect(suggestReports).not.toHaveBeenCalled();
});

test("hints appear after the answer", async () => {
  const { result } = render(props("Big pothole on Zelena street near house"));
  await flush(PAUSE_MS + 50);
  expect(result.current.items.map((i) => i.reportId)).toEqual(["a"]);
});

test("a small edit does not trigger another request", async () => {
  const base = "Big pothole on Zelena street near house 15";
  const { rerender } = render(props(base));
  await flush(PAUSE_MS + 50);
  expect(suggestReports).toHaveBeenCalledTimes(1);

  rerender(props(`${base}!!`));
  await flush(PAUSE_MS + 50);
  expect(suggestReports).toHaveBeenCalledTimes(1);

  rerender(props(`${base} ${"x".repeat(MIN_TEXT_CHANGE)}`));
  await flush(PAUSE_MS + 50);
  expect(suggestReports).toHaveBeenCalledTimes(2);
});

test("moving the point asks again", async () => {
  const text = "Big pothole on Zelena street near house 15";
  const { rerender } = render(props(text));
  await flush(PAUSE_MS + 50);

  rerender(props(text, { lat: 49.85, lng: 24.04 }));
  await flush(PAUSE_MS + 50);
  expect(suggestReports).toHaveBeenCalledTimes(2);
});

test("an outdated answer does not overwrite a newer one", async () => {
  let resolveFirst;
  suggestReports.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFirst = resolve;
    }),
  );
  suggestReports.mockResolvedValueOnce({ items: [item("new")] });

  const first = "Big pothole on Zelena street near house 15";
  const { result, rerender } = render(props(first));
  await flush(PAUSE_MS + 50); // request 1 is in flight

  rerender(props(`${first} and it is getting worse every day`));
  await flush(PAUSE_MS + 50); // request 2 answers at once
  expect(result.current.items.map((i) => i.reportId)).toEqual(["new"]);

  await act(async () => {
    resolveFirst({ items: [item("old")] });
  });
  expect(result.current.items.map((i) => i.reportId)).toEqual(["new"]);
});

test("check() reuses the last result when nothing changed", async () => {
  const { result } = render(props("Big pothole on Zelena street near house"));
  await flush(PAUSE_MS + 50);
  expect(suggestReports).toHaveBeenCalledTimes(1);

  let found;
  await act(async () => {
    found = await result.current.check();
  });
  expect(found.map((i) => i.reportId)).toEqual(["a"]);
  expect(suggestReports).toHaveBeenCalledTimes(1);
});

test("check() asks once when the hints are not ready yet", async () => {
  const { result } = render(props("Big pothole on Zelena street near house"));
  // No pause yet: the automatic request has not started.
  let found;
  await act(async () => {
    found = await result.current.check();
  });
  expect(found.map((i) => i.reportId)).toEqual(["a"]);
  expect(suggestReports).toHaveBeenCalledTimes(1);

  await flush(PAUSE_MS + 50); // the automatic one reuses the same result
  expect(suggestReports).toHaveBeenCalledTimes(1);
});

test("a failed request means no hints and no error", async () => {
  suggestReports.mockRejectedValue(new Error("network"));
  const { result } = render(props("Big pothole on Zelena street near house"));
  await flush(PAUSE_MS + 50);
  expect(result.current.items).toEqual([]);

  let found;
  await act(async () => {
    found = await result.current.check();
  });
  expect(found).toEqual([]);
});

test("check() with short text returns nothing without a request", async () => {
  const { result } = render(props("short"));
  let found;
  await act(async () => {
    found = await result.current.check();
  });
  expect(found).toEqual([]);
  expect(suggestReports).not.toHaveBeenCalled();
});

test("markSupported remembers the report", async () => {
  const { result } = render(props(""));
  act(() => result.current.markSupported("a"));
  expect(result.current.supportedIds.has("a")).toBe(true);
});
