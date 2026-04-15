/**
 * lib/rateLimit.js  —  Simple in-memory rate limiter
 * Works per-userId (not just IP) so VPNs can't bypass it.
 *
 * Usage:
 *   const limiter = createLimiter({ max: 5, windowMs: 60_000 });
 *   const { limited, remaining, resetIn } = limiter.check(userId);
 */

export function createLimiter({ max, windowMs }) {
  const store = new Map(); // userId → { count, resetAt }

  return {
    check(key) {
      const now  = Date.now();
      const rec  = store.get(key);

      if (!rec || now > rec.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { limited: false, remaining: max - 1, resetIn: windowMs };
      }

      if (rec.count >= max) {
        return { limited: true, remaining: 0, resetIn: rec.resetAt - now };
      }

      rec.count++;
      return { limited: false, remaining: max - rec.count, resetIn: rec.resetAt - now };
    },

    reset(key) {
      store.delete(key);
    },
  };
}

// Shared limiters — singleton per module load
export const contactRequestLimiter = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });  // 10/hr
export const messageLimiter        = createLimiter({ max: 60, windowMs: 60 * 1000 });          // 60/min
