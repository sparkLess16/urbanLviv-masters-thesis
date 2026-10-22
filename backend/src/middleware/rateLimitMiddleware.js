// Minimal in-memory limiter (per user, falling back to IP): at most `max`
// requests per `windowMs`. Enough for a single-process deployment.
export const rateLimit = ({ windowMs, max }) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.user?.id ?? req.ip;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(
      (time) => now - time < windowMs,
    );

    if (recent.length >= max) {
      hits.set(key, recent);
      return res
        .status(429)
        .json({ message: "Too many requests, try again later" });
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
};
