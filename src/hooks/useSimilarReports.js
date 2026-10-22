import { useCallback, useEffect, useRef, useState } from "react";
import { suggestReports } from "../services/supportApi";
import { useDebouncedValue } from "./useDebouncedValue";

// Every request may cost a paid embedding call on the server, so requests are
// rare: after a pause in typing, from 20 characters, and only when the text
// grew or shrank by 10+ characters since the last request (or the point moved).
export const PAUSE_MS = 900;
export const MIN_TEXT_LENGTH = 20;
export const MIN_TEXT_CHANGE = 10;

export const buildText = (title, description) =>
  [title.trim(), description.trim()].filter(Boolean).join(". ");

const makeKey = (text, point) => `${text}|${point?.lat}|${point?.lng}`;

const samePoint = (a, b) => a?.lat === b?.lat && a?.lng === b?.lng;

// Live hints ("similar reports nearby") for the report form.
// `check()` returns the hints for the current inputs: the last result when the
// inputs did not change (no new request), otherwise a fresh request. It never
// throws: a failed request means no hints.
export const useSimilarReports = ({ title, description, coordinates }) => {
  const text = buildText(title, description);
  const debouncedText = useDebouncedValue(text, PAUSE_MS);
  const lat = coordinates?.lat;
  const lng = coordinates?.lng;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [supportedIds, setSupportedIds] = useState(() => new Set());

  // Last finished request: { key, text, point, items }.
  const lastRef = useRef(null);
  // Request in flight: { key, promise }.
  const pendingRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const inputsRef = useRef({});
  inputsRef.current = { title, description, text, lat, lng };

  const request = useCallback((key, text, point) => {
    if (pendingRef.current?.key === key) return pendingRef.current.promise;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const { title, description } = inputsRef.current;
    setIsLoading(true);

    const promise = suggestReports(
      { title, description, lat: point.lat, lng: point.lng },
      controller.signal,
    )
      .then((data) => {
        const found = data.items ?? [];
        // A newer request has started: this answer is outdated.
        if (requestId !== requestIdRef.current) return [];
        lastRef.current = { key, text, point, items: found };
        setItems(found);
        return found;
      })
      .catch(() => [])
      .finally(() => {
        if (requestId === requestIdRef.current) {
          pendingRef.current = null;
          setIsLoading(false);
        }
      });

    pendingRef.current = { key, promise };
    return promise;
  }, []);

  // Automatic hints while typing.
  useEffect(() => {
    const point = lat === undefined ? null : { lat, lng };

    if (debouncedText.length < MIN_TEXT_LENGTH || !point) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      pendingRef.current = null;
      lastRef.current = null;
      setItems([]);
      setIsLoading(false);
      return;
    }

    const last = lastRef.current;
    const textBarelyChanged =
      last &&
      Math.abs(debouncedText.length - last.text.length) < MIN_TEXT_CHANGE;
    if (last && samePoint(last.point, point) && textBarelyChanged) return;

    request(makeKey(debouncedText, point), debouncedText, point);
  }, [debouncedText, lat, lng, request]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const check = useCallback(async () => {
    const { text, lat, lng } = inputsRef.current;
    if (text.length < MIN_TEXT_LENGTH || lat === undefined) return [];

    const point = { lat, lng };
    const key = makeKey(text, point);
    if (lastRef.current?.key === key) return lastRef.current.items;
    return request(key, text, point);
  }, [request]);

  const markSupported = useCallback((reportId) => {
    setSupportedIds((previous) => new Set(previous).add(reportId));
  }, []);

  return { items, isLoading, supportedIds, markSupported, check };
};
