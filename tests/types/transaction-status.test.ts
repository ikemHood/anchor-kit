import { TRANSACTION_STATUSES, type TransactionStatus } from '@/types/index.ts';

describe('TransactionStatus', () => {
  // -- runtime checks on the status array --

  it('has exactly 14 entries', () => {
    expect(TRANSACTION_STATUSES).toHaveLength(14);
  });

  it('covers every SEP-24 lifecycle status', () => {
    const expected = [
      'incomplete',
      'pending_anchor',
      'pending_user_transfer_start',
      'pending_user_transfer_complete',
      'pending_external',
      'pending_trust',
      'pending_user',
      'completed',
      'refunded',
      'expired',
      'error',
      'no_market',
      'too_small',
      'too_large',
    ];

    for (const s of expected) {
      expect(TRANSACTION_STATUSES).toContain(s);
    }
  });

  it('contains no duplicates', () => {
    const unique = new Set(TRANSACTION_STATUSES);
    expect(unique.size).toBe(TRANSACTION_STATUSES.length);
  });

  // -- compile-time checks (tsc catches these before tests even run) --

  it('accepts every valid status', () => {
    const a: TransactionStatus = 'incomplete';
    const b: TransactionStatus = 'pending_anchor';
    const c: TransactionStatus = 'pending_user_transfer_start';
    const d: TransactionStatus = 'pending_user_transfer_complete';
    const e: TransactionStatus = 'pending_external';
    const f: TransactionStatus = 'pending_trust';
    const g: TransactionStatus = 'pending_user';
    const h: TransactionStatus = 'completed';
    const i: TransactionStatus = 'refunded';
    const j: TransactionStatus = 'expired';
    const k: TransactionStatus = 'error';
    const l: TransactionStatus = 'no_market';
    const m: TransactionStatus = 'too_small';
    const n: TransactionStatus = 'too_large';

    // keep the compiler happy about unused vars
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    expect(d).toBeDefined();
    expect(e).toBeDefined();
    expect(f).toBeDefined();
    expect(g).toBeDefined();
    expect(h).toBeDefined();
    expect(i).toBeDefined();
    expect(j).toBeDefined();
    expect(k).toBeDefined();
    expect(l).toBeDefined();
    expect(m).toBeDefined();
    expect(n).toBeDefined();
  });

  it('rejects invalid strings at compile time', () => {
    // @ts-expect-error — not a real status
    const x: TransactionStatus = 'invalid';

    // @ts-expect-error — wrong casing
    const y: TransactionStatus = 'COMPLETED';

    // @ts-expect-error — partial match doesn't count
    const z: TransactionStatus = 'pending';

    expect(x).toBeDefined();
    expect(y).toBeDefined();
    expect(z).toBeDefined();
  });
});
