import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '@/runtime/http/rate-limiter.ts';

describe('InMemoryRateLimiter', () => {
  it('blocks requests after limit within window', () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { windowMs: 60000, max: 2 };

    const first = limiter.hit('auth:127.0.0.1', rule);
    const second = limiter.hit('auth:127.0.0.1', rule);
    const third = limiter.hit('auth:127.0.0.1', rule);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});
