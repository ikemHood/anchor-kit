import type { Customer, KycData } from '@/types/index.ts';

describe('Customer', () => {
  // -- required fields only --

  it('works with just the required fields', () => {
    const c: Customer = {
      id: 'abc-123',
      accountId: 'GABCD1234',
      createdAt: new Date(),
    };

    expect(c.id).toBe('abc-123');
    expect(c.accountId).toBe('GABCD1234');
    expect(c.createdAt).toBeInstanceOf(Date);
  });

  // -- optional fields --

  it('accepts email, phone, and kycData when provided', () => {
    const c: Customer = {
      id: 'abc-123',
      accountId: 'GABCD1234',
      createdAt: new Date(),
      email: 'user@example.com',
      phone: '+2348012345678',
      kycData: { status: 'pending' },
    };

    expect(c.email).toBe('user@example.com');
    expect(c.phone).toBe('+2348012345678');
    expect(c.kycData?.status).toBe('pending');
  });

  it('allows kycData with SEP-12 identity fields', () => {
    const kyc: KycData = {
      status: 'approved',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email_address: 'ada@example.com',
    };

    const c: Customer = {
      id: 'xyz-789',
      accountId: 'GXYZ9876',
      createdAt: new Date(),
      kycData: kyc,
    };

    expect(c.kycData?.first_name).toBe('Ada');
  });

  // -- compile-time: missing required fields --

  it('rejects missing required fields at compile time', () => {
    // @ts-expect-error — missing id, accountId, createdAt
    const bad1: Customer = {};

    // @ts-expect-error — missing accountId and createdAt
    const bad2: Customer = { id: 'abc' };

    expect(bad1).toBeDefined();
    expect(bad2).toBeDefined();
  });

  // -- compile-time: kycData shape enforcement --

  it('rejects wrong kycData shape at compile time', () => {
    const bad: Customer = {
      id: 'abc',
      accountId: 'GABCD',
      createdAt: new Date(),
      // @ts-expect-error — kycData must match KycData shape
      kycData: { wrong: true },
    };

    expect(bad).toBeDefined();
  });
});
