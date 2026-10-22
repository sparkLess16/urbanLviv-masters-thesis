import { useCallback, useRef, useState } from "react";
import api from "../services/api";
import { isWithinLviv } from "../utils/geo";

const GEOLOCATION_ERRORS = {
  1: "Location access was denied. Allow it in the browser or click on the map",
  2: "Your position is unavailable. Click on the map instead",
  3: "Locating took too long. Try again or click on the map",
};

// One behaviour for every way of choosing a point (map click, marker drag,
// "My location" button): save the point, then fill district and address.
// A new point replaces the address text (if the geocoder found an address).
export const useLocationAutofill = ({
  setCoordinates,
  setDistrictId,
  setAddress,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [hint, setHint] = useState(null);
  const lastRequestRef = useRef(0);
  const typedSinceSearchRef = useRef(false);
  const callbacksRef = useRef({});

  callbacksRef.current = { setCoordinates, setDistrictId, setAddress };

  // Call from the location input's onChange: the next blur/Enter searches.
  const onLocationTyped = useCallback(() => {
    typedSinceSearchRef.current = true;
  }, []);

  // Looks the typed address up and moves the point/district to it. Called on
  // blur or Enter. The typed text itself is never changed; if nothing is
  // found, point and district stay as they were.
  const searchAddress = useCallback(async (text) => {
    const query = text.trim();
    if (!typedSinceSearchRef.current || query.length < 3) return;
    typedSinceSearchRef.current = false;

    const { setCoordinates, setDistrictId } = callbacksRef.current;
    const requestId = ++lastRequestRef.current;
    setHint(null);

    try {
      const { data } = await api.get("/api/geo/forward", {
        params: { q: query },
      });
      // A map click or a newer search has happened meanwhile: stale.
      if (requestId !== lastRequestRef.current) return;

      if (!data.found) {
        setHint("Address not found in Lviv. Check it or click on the map");
        return;
      }
      setCoordinates({ lat: data.lat, lng: data.lng });
      if (data.district_id) setDistrictId(data.district_id);
    } catch (err) {
      if (requestId !== lastRequestRef.current) return;
      console.error("Address search failed", err);
      setHint("Could not look the address up. Click on the map instead");
    }
  }, []);

  const pickPoint = useCallback(async (point) => {
    const { setCoordinates, setDistrictId, setAddress } = callbacksRef.current;
    const requestId = ++lastRequestRef.current;

    setCoordinates(point);
    setHint(null);

    try {
      const { data } = await api.get("/api/geo/reverse", {
        params: { lat: point.lat, lng: point.lng },
      });
      // A newer pick has started: this answer is stale.
      if (requestId !== lastRequestRef.current) return;

      if (data.district_id) setDistrictId(data.district_id);
      if (data.display) setAddress(data.display);
      if (!data.display) {
        setHint("Address not found, please fill in the place manually");
      }
    } catch (err) {
      if (requestId !== lastRequestRef.current) return;
      console.error("Reverse geocoding failed", err);
      setHint("Could not detect the address, please fill it in manually");
    }
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setHint("Your browser does not support geolocation. Click on the map");
      return;
    }
    setIsLocating(true);
    setHint(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        if (!isWithinLviv(coords.latitude, coords.longitude)) {
          setHint("Your location is outside Lviv. Click on the map instead");
          return;
        }
        pickPoint({ lat: coords.latitude, lng: coords.longitude });
      },
      (error) => {
        setIsLocating(false);
        setHint(GEOLOCATION_ERRORS[error.code] || GEOLOCATION_ERRORS[2]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [pickPoint]);

  return {
    pickPoint,
    locate,
    searchAddress,
    isLocating,
    hint,
    onLocationTyped,
  };
};
