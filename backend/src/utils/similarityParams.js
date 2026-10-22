import { DEFAULTS, STRATEGIES } from "../services/similarityService.js";

const parseNumber = (raw, fallback, { min, max, name }) => {
  if (raw === undefined || raw === "") return { value: fallback };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { error: `${name} must be a number between ${min} and ${max}` };
  }
  return { value };
};

// Reads strategy, alpha, radius and limit from a query string.
// Returns { params } or { error } with a user-facing message.
export const parseSimilarityParams = (query) => {
  const strategy = query.strategy ?? "vector";
  if (!Object.hasOwn(STRATEGIES, strategy)) {
    return { error: 'strategy must be "vector" or "geo"' };
  }

  const alpha = parseNumber(query.alpha, DEFAULTS.alpha, {
    min: 0,
    max: 1,
    name: "alpha",
  });
  const radiusM = parseNumber(query.radius, DEFAULTS.radiusM, {
    min: 50,
    max: 5000,
    name: "radius",
  });
  const limit = parseNumber(query.limit, DEFAULTS.limit, {
    min: 1,
    max: 20,
    name: "limit",
  });

  const failed = [alpha, radiusM, limit].find((result) => result.error);
  if (failed) return { error: failed.error };

  return {
    params: {
      strategy,
      alpha: alpha.value,
      radiusM: radiusM.value,
      limit: Math.floor(limit.value),
    },
  };
};
