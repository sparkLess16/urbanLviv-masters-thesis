// Cache of query vectors so that identical texts never cost a second Gemini
// call. The key is the whole normalized text (trim, lower case, collapsed
// spaces), not single words. An in-flight request is shared by simultaneous
// callers; failed requests are not cached.
export const normalizeText = (text) =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

export const createCachedEmbedder = (embed, limit = 500) => {
  const cache = new Map();

  return async (text) => {
    const key = normalizeText(text);
    if (cache.has(key)) {
      // Refresh position: the Map order is the LRU order.
      const entry = cache.get(key);
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    }

    const pending = embed(text).catch((error) => {
      cache.delete(key);
      throw error;
    });
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
    cache.set(key, pending);
    return pending;
  };
};
