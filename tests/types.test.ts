/**
 * Type tests for DepositTransaction
 * Verifies discriminated union narrowing and type compatibility
 */

import { describe, it, expectTypeOf } from 'vitest';
import type {
  DepositTransaction,
  Sep24TransactionResponse,
  WithdrawalTransaction,
  BaseTransactionResponse,
  TransactionNotFoundError,
} from '../src/types/sep24';
import {
  isDepositTransaction,
  isWithdrawalTransaction,
  isTransactionNotFoundError,
} from '../src/types/sep24';
import type { TransactionStatus } from '../src/types';

describe('DepositTransaction Type Tests', () => {
  describe('DepositTransaction interface', () => {
    it('should have type discriminator set to "deposit"', () => {
      const deposit: DepositTransaction = {
        type: 'deposit',
        id: 'deposit-123',
        status: 'completed',
      };

      expectTypeOf(deposit.type).toEqualTypeOf<'deposit'>();
    });

    it('should require id and status fields', () => {
      const deposit: DepositTransaction = {
        type: 'deposit',
        id: 'deposit-123',
        status: 'completed',
      };

      expectTypeOf(deposit.id).toMatchTypeOf<string>();
      expectTypeOf(deposit.status).toMatchTypeOf<TransactionStatus>();
    });

    it('should extend BaseTransactionResponse', () => {
      const deposit: DepositTransaction = {
        type: 'deposit',
        id: 'deposit-123',
        status: 'completed',
        amount_in: {
          amount: '100.00',
          asset: 'USD',
        },
      };

      expectTypeOf(deposit).toMatchTypeOf<BaseTransactionResponse>();
    });
  });

  describe('Sep24TransactionResponse compatibility', () => {
    it('should be assignable to Sep24TransactionResponse for deposits', () => {
      const depositTx: DepositTransaction = {
        type: 'deposit',
        id: 'dep-1',
        status: 'pending_user_transfer_start',
      };

      const txResponse: Sep24TransactionResponse = depositTx;
      expectTypeOf(txResponse).toMatchTypeOf<Sep24TransactionResponse>();
    });

    it('should narrow from Sep24TransactionResponse to DepositTransaction', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'deposit',
        id: 'dep-1',
        status: 'completed',
      };

      if (transaction.type === 'deposit') {
        expectTypeOf(transaction).toEqualTypeOf<DepositTransaction>();
      }
    });

    it('should support discriminated union with withdrawals', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'deposit',
        id: 'dep-1',
        status: 'completed',
      };

      const testUnion = (tx: Sep24TransactionResponse) => {
        if (tx.type === 'deposit') {
          expectTypeOf(tx).toEqualTypeOf<DepositTransaction>();
        } else {
          expectTypeOf(tx).toEqualTypeOf<WithdrawalTransaction>();
        }
      };

      testUnion(transaction);
    });
  });

  describe('Type guard functions', () => {
    it('isDepositTransaction should narrow correctly', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'deposit',
        id: 'dep-1',
        status: 'completed',
      };

      if (isDepositTransaction(transaction)) {
        expectTypeOf(transaction).toEqualTypeOf<DepositTransaction>();
      }
    });

    it('isWithdrawalTransaction should narrow to WithdrawalTransaction', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'withdrawal',
        id: 'wd-1',
        status: 'completed',
      };

      if (isWithdrawalTransaction(transaction)) {
        expectTypeOf(transaction).toEqualTypeOf<WithdrawalTransaction>();
      }
    });

    it('should use type guards for runtime filtering', () => {
      const transactions: Sep24TransactionResponse[] = [
        { type: 'deposit', id: 'dep-1', status: 'completed' },
        { type: 'withdrawal', id: 'wd-1', status: 'pending_external' },
        { type: 'deposit', id: 'dep-2', status: 'error' },
      ];

      const deposits = transactions.filter(isDepositTransaction);
      const withdrawals = transactions.filter(isWithdrawalTransaction);

      expectTypeOf(deposits).toMatchTypeOf<DepositTransaction[]>();
      expectTypeOf(withdrawals).toMatchTypeOf<WithdrawalTransaction[]>();
    });
  });

  describe('Field compatibility', () => {
    it('should support all optional BaseTransactionResponse fields', () => {
      const deposit: DepositTransaction = {
        type: 'deposit',
        id: 'dep-1',
        status: 'completed',
        more_info_url: 'https://example.com/info',
        amount_in: {
          amount: '100.00',
          asset: 'USD',
        },
        amount_out: {
          amount: '95.00',
          asset: 'USDC',
        },
        amount_fee: {
          amount: '5.00',
          asset: 'USD',
        },
        started_at: 1000000,
        completed_at: 2000000,
        message: 'Transaction completed',
      };

      expectTypeOf(deposit.type).toEqualTypeOf<'deposit'>();
      expectTypeOf(deposit.id).toEqualTypeOf<string>();
      expectTypeOf(deposit.status).toMatchTypeOf<string>();
    });
  });
});

describe('WithdrawalTransaction Type Tests', () => {
  describe('WithdrawalTransaction interface', () => {
    it('should have type discriminator set to "withdrawal"', () => {
      const withdrawal: WithdrawalTransaction = {
        type: 'withdrawal',
        id: 'withdrawal-123',
        status: 'pending_external',
      };

      expectTypeOf(withdrawal.type).toEqualTypeOf<'withdrawal'>();
    });

    it('should require id and status fields', () => {
      const withdrawal: WithdrawalTransaction = {
        type: 'withdrawal',
        id: 'withdrawal-123',
        status: 'pending_external',
      };

      expectTypeOf(withdrawal.id).toMatchTypeOf<string>();
      expectTypeOf(withdrawal.status).toMatchTypeOf<TransactionStatus>();
    });

    it('should extend BaseTransactionResponse', () => {
      const withdrawal: WithdrawalTransaction = {
        type: 'withdrawal',
        id: 'withdrawal-123',
        status: 'completed',
        amount_out: {
          amount: '100.00',
          asset: 'USD',
        },
      };

      expectTypeOf(withdrawal).toMatchTypeOf<BaseTransactionResponse>();
    });
  });

  describe('Sep24TransactionResponse compatibility', () => {
    it('should be assignable to Sep24TransactionResponse for withdrawals', () => {
      const withdrawalTx: WithdrawalTransaction = {
        type: 'withdrawal',
        id: 'wd-1',
        status: 'pending_user_transfer_complete',
      };

      const txResponse: Sep24TransactionResponse = withdrawalTx;
      expectTypeOf(txResponse).toMatchTypeOf<Sep24TransactionResponse>();
    });

    it('should narrow from Sep24TransactionResponse to WithdrawalTransaction', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'withdrawal',
        id: 'wd-1',
        status: 'completed',
      };

      if (transaction.type === 'withdrawal') {
        expectTypeOf(transaction).toEqualTypeOf<WithdrawalTransaction>();
      }
    });
  });

  describe('Type guard for withdrawals', () => {
    it('isWithdrawalTransaction should narrow correctly', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'withdrawal',
        id: 'wd-1',
        status: 'pending_stellar',
      };

      if (isWithdrawalTransaction(transaction)) {
        expectTypeOf(transaction).toEqualTypeOf<WithdrawalTransaction>();
      }
    });
  });

  describe('Field compatibility for withdrawals', () => {
    it('should support all optional BaseTransactionResponse fields', () => {
      const withdrawal: WithdrawalTransaction = {
        type: 'withdrawal',
        id: 'wd-1',
        status: 'completed',
        more_info_url: 'https://example.com/info',
        amount_out: {
          amount: '100.00',
          asset: 'USD',
        },
        amount_fee: {
          amount: '1.00',
          asset: 'USD',
        },
        started_at: 1000000,
        completed_at: 2000000,
        message: 'Withdrawal processed',
      };

      expectTypeOf(withdrawal.type).toEqualTypeOf<'withdrawal'>();
      expectTypeOf(withdrawal.id).toEqualTypeOf<string>();
      expectTypeOf(withdrawal.status).toMatchTypeOf<string>();
    });
  });
});

describe('TransactionNotFoundError Type Tests', () => {
  describe('TransactionNotFoundError interface', () => {
    it('should have type discriminator set to "not_found"', () => {
      const error: TransactionNotFoundError = {
        type: 'not_found',
        error: 'Transaction not found',
      };

      expectTypeOf(error.type).toEqualTypeOf<'not_found'>();
    });

    it('should require type and error fields', () => {
      const error: TransactionNotFoundError = {
        type: 'not_found',
        error: 'Transaction with id "txn-999" not found',
      };

      expectTypeOf(error.type).toEqualTypeOf<'not_found'>();
      expectTypeOf(error.error).toEqualTypeOf<string>();
    });
  });

  describe('Sep24TransactionResponse compatibility', () => {
    it('should be assignable to Sep24TransactionResponse for errors', () => {
      const errorResponse: TransactionNotFoundError = {
        type: 'not_found',
        error: 'Transaction not found',
      };

      const txResponse: Sep24TransactionResponse = errorResponse;
      expectTypeOf(txResponse).toMatchTypeOf<Sep24TransactionResponse>();
    });

    it('should narrow from Sep24TransactionResponse to TransactionNotFoundError', () => {
      const transaction: Sep24TransactionResponse = {
        type: 'not_found',
        error: 'Transaction not found',
      };

      if (transaction.type === 'not_found') {
        expectTypeOf(transaction).toEqualTypeOf<TransactionNotFoundError>();
      }
    });
  });

  describe('Type guard for error responses', () => {
    it('isTransactionNotFoundError should narrow correctly', () => {
      const response: Sep24TransactionResponse = {
        type: 'not_found',
        error: 'Transaction does not exist',
      };

      if (isTransactionNotFoundError(response)) {
        expectTypeOf(response).toEqualTypeOf<TransactionNotFoundError>();
      }
    });
  });

  describe('Discriminated union with all branches', () => {
    it('should support discriminated union with all three transaction types', () => {
      const responses: Sep24TransactionResponse[] = [
        {
          type: 'deposit',
          id: 'dep-1',
          status: 'completed',
        },
        {
          type: 'withdrawal',
          id: 'wd-1',
          status: 'pending_external',
        },
        {
          type: 'not_found',
          error: 'Transaction not found',
        },
      ];

      const testUnion = (response: Sep24TransactionResponse) => {
        if (response.type === 'deposit') {
          expectTypeOf(response).toEqualTypeOf<DepositTransaction>();
        } else if (response.type === 'withdrawal') {
          expectTypeOf(response).toEqualTypeOf<WithdrawalTransaction>();
        } else {
          expectTypeOf(response).toEqualTypeOf<TransactionNotFoundError>();
        }
      };

      responses.forEach(testUnion);
    });

    it('should use type guards for runtime filtering of all branches', () => {
      const responses: Sep24TransactionResponse[] = [
        { type: 'deposit', id: 'dep-1', status: 'completed' },
        { type: 'not_found', error: 'Not found' },
        { type: 'withdrawal', id: 'wd-1', status: 'pending_external' },
        { type: 'not_found', error: 'Another not found' },
      ];

      const deposits = responses.filter(isDepositTransaction);
      const withdrawals = responses.filter(isWithdrawalTransaction);
      const notFounds = responses.filter(isTransactionNotFoundError);

      expectTypeOf(deposits).toMatchTypeOf<DepositTransaction[]>();
      expectTypeOf(withdrawals).toMatchTypeOf<WithdrawalTransaction[]>();
      expectTypeOf(notFounds).toMatchTypeOf<TransactionNotFoundError[]>();

      // Verify runtime filtering works as expected
      expect(deposits.length).toBe(1);
      expect(withdrawals.length).toBe(1);
      expect(notFounds.length).toBe(2);
    });

    it('should allow exhaustive switch on response type', () => {
      const response: Sep24TransactionResponse = {
        type: 'not_found',
        error: 'Transaction not found',
      };

      let result: string;
      switch (response.type) {
        case 'deposit':
          result = `Deposit ${response.id}`;
          break;
        case 'withdrawal':
          result = `Withdrawal ${response.id}`;
          break;
        case 'not_found':
          result = `Error: ${response.error}`;
          break;
      }

      expect(result).toBe('Error: Transaction not found');
      expectTypeOf(result).toEqualTypeOf<string>();
    });
  });
});

