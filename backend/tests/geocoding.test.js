import test from "node:test";
import assert from "node:assert/strict";
import {
  createGeocodingService,
  createNominatimProvider,
  formatNominatimAddress,
  parseNominatimSearch,
} from "../src/services/geocodingService.js";
import { rateLimit } from "../src/middleware/rateLimitMiddleware.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

test("formats house number and road", () => {
  assert.equal(
    formatNominatimAddress({ house_number: "15", road: "Zelena Street" }),
    "15 Zelena Street",
  );
});

test("formats a road without a house number", () => {
  assert.equal(
    formatNominatimAddress({ road: "Zelena Street" }),
    "Zelena Street",
  );
});

test("returns null when the address has no road", () => {
  assert.equal(formatNominatimAddress({ city: "Lviv" }), null);
  assert.equal(formatNominatimAddress(undefined), null);
});

test("provider parses a Nominatim response and sends accept-language=en", async () => {
  let requested;
  const provider = createNominatimProvider({
    minIntervalMs: 0,
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return jsonResponse({
        address: { house_number: "12", road: "Stusa Street" },
      });
    },
  });

  assert.equal(await provider.reverse(49.8, 24.0), "12 Stusa Street");
  assert.match(requested.url, /accept-language=en/);
  assert.ok(requested.options.headers["User-Agent"]);
});

test("provider rejects on a non-OK response", async () => {
  const provider = createNominatimProvider({
    minIntervalMs: 0,
    fetchImpl: async () => jsonResponse({}, false, 503),
  });
  await assert.rejects(provider.reverse(49.8, 24.0), /503/);
});

test("service caches by rounded coordinates", async () => {
  let calls = 0;
  const service = createGeocodingService({
    reverse: async () => {
      calls += 1;
      return "Cached Street";
    },
  });

  assert.equal(
    await service.reverseGeocode(49.84191, 24.03151),
    "Cached Street",
  );
  assert.equal(
    await service.reverseGeocode(49.84193, 24.03149),
    "Cached Street",
  );
  assert.equal(calls, 1);
});

test("service returns null instead of throwing when the provider fails", async () => {
  const service = createGeocodingService({
    reverse: async () => {
      throw new Error("down");
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await service.reverseGeocode(49.8, 24.0), null);
  } finally {
    console.error = originalError;
  }
});

test("rate limiter blocks requests over the limit", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  const req = { ip: "1.2.3.4" };
  const makeRes = () => ({
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  });
  let passed = 0;
  const next = () => (passed += 1);

  limiter(req, makeRes(), next);
  limiter(req, makeRes(), next);
  const blocked = makeRes();
  limiter(req, blocked, next);

  assert.equal(passed, 2);
  assert.equal(blocked.statusCode, 429);
});

test("parses the first search result inside Lviv", () => {
  assert.deepEqual(parseNominatimSearch([{ lat: "49.8419", lon: "24.0315" }]), {
    lat: 49.8419,
    lng: 24.0315,
  });
});

test("search result outside Lviv, empty or invalid gives null", () => {
  assert.equal(parseNominatimSearch([{ lat: "50.45", lon: "30.52" }]), null);
  assert.equal(parseNominatimSearch([]), null);
  assert.equal(parseNominatimSearch([{ lat: "x", lon: "y" }]), null);
  assert.equal(parseNominatimSearch(undefined), null);
});

test("provider.forward queries search bounded to Lviv", async () => {
  let url;
  const provider = createNominatimProvider({
    minIntervalMs: 0,
    fetchImpl: async (requested) => {
      url = requested;
      return jsonResponse([{ lat: "49.8419", lon: "24.0315" }]);
    },
  });

  assert.deepEqual(await provider.forward("Rynok Square 1"), {
    lat: 49.8419,
    lng: 24.0315,
  });
  assert.match(url, /\/search\?/);
  assert.match(url, /bounded=1/);
  assert.match(url, /viewbox=/);
});

test("service caches forward lookups ignoring case and spaces", async () => {
  let calls = 0;
  const service = createGeocodingService({
    forward: async () => {
      calls += 1;
      return { lat: 49.84, lng: 24.03 };
    },
  });

  await service.forwardGeocode("Zelena  15");
  await service.forwardGeocode(" zelena 15 ");
  assert.equal(calls, 1);
});
