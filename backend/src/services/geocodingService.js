// Geocoding behind a provider interface. A provider is an object with
//   reverse(lat, lng) -> Promise<string | null>          (short address)
//   forward(query)    -> Promise<{ lat, lng } | null>    (point inside Lviv)
// Switching to another geocoder (e.g. Google) means adding a new provider.
import { LVIV_BOUNDS, isWithinLviv } from "../utils/geo.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "UrbanLviv-diploma-geocoder/1.0";
// Nominatim usage policy: at most 1 request per second.
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_LIMIT = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "15 Zelena Street" from the Nominatim `address` block; null if no road found.
export const formatNominatimAddress = (address = {}) => {
  const road =
    address.road || address.pedestrian || address.footway || address.square;
  if (!road) return null;
  return address.house_number ? `${address.house_number} ${road}` : road;
};

// First search result as { lat, lng } if it lies inside Lviv, else null.
export const parseNominatimSearch = (results) => {
  const first = Array.isArray(results) ? results[0] : null;
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return isWithinLviv(lat, lng) ? { lat, lng } : null;
};

export const createNominatimProvider = ({
  fetchImpl = fetch,
  minIntervalMs = MIN_INTERVAL_MS,
} = {}) => {
  // Serializes upstream calls so the 1 req/s limit holds across users.
  let queue = Promise.resolve();
  let lastCallAt = 0;

  const getJson = async (endpoint, params) => {
    const wait = lastCallAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    const response = await fetchImpl(
      `${NOMINATIM_URL}/${endpoint}?${new URLSearchParams(params)}`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Nominatim responded with ${response.status}`);
    }
    return response.json();
  };

  const enqueue = (task) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };

  return {
    reverse: (lat, lng) =>
      enqueue(async () => {
        const body = await getJson("reverse", {
          lat,
          lon: lng,
          format: "json",
          addressdetails: "1",
          zoom: "18",
          "accept-language": "en",
        });
        return formatNominatimAddress(body.address);
      }),

    // Search is limited to the Lviv bounding box (viewbox + bounded).
    forward: (query) =>
      enqueue(async () => {
        const results = await getJson("search", {
          q: `${query}, Lviv`,
          format: "jsonv2",
          limit: "1",
          countrycodes: "ua",
          viewbox: [
            LVIV_BOUNDS.minLng,
            LVIV_BOUNDS.maxLat,
            LVIV_BOUNDS.maxLng,
            LVIV_BOUNDS.minLat,
          ].join(","),
          bounded: "1",
          "accept-language": "en",
        });
        return parseNominatimSearch(results);
      }),
  };
};

// Reverse cache key: coordinates rounded to 4 decimals (~11 m).
const reverseKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
const forwardKey = (query) => query.trim().toLowerCase().replace(/\s+/g, " ");

export const createGeocodingService = (
  provider = createNominatimProvider(),
) => {
  const reverseCache = new Map();
  const forwardCache = new Map();

  const remember = (cache, key, value) => {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, value);
  };

  // Both methods return null instead of throwing when the provider fails:
  // the caller still gets the district from the polygons.
  const reverseGeocode = async (lat, lng) => {
    const key = reverseKey(lat, lng);
    if (reverseCache.has(key)) return reverseCache.get(key);

    try {
      const address = await provider.reverse(lat, lng);
      remember(reverseCache, key, address);
      return address;
    } catch (error) {
      console.error("Reverse geocoding failed:", error.message);
      return null;
    }
  };

  const forwardGeocode = async (query) => {
    const key = forwardKey(query);
    if (forwardCache.has(key)) return forwardCache.get(key);

    try {
      const point = await provider.forward(query);
      remember(forwardCache, key, point);
      return point;
    } catch (error) {
      console.error("Forward geocoding failed:", error.message);
      return null;
    }
  };

  return { reverseGeocode, forwardGeocode };
};

export const geocodingService = createGeocodingService();
