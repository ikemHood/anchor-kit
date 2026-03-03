import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import jwt from 'jsonwebtoken';
import { ValidationError } from '@/core/errors.ts';
import type { AnchorConfig } from '@/core/config.ts';
import type { DatabaseAdapter, WebhookProcessor } from '@/runtime/interfaces.ts';

export type ExpressLikeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: unknown) => void,
) => void;

interface RouterDependencies {
  config: AnchorConfig;
  database: DatabaseAdapter;
  webhookProcessor: WebhookProcessor;
}

interface AuthenticatedRequestData {
  account: string;
}

interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
  }
  res.end(JSON.stringify(body));
}

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost');
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const bodyFromFramework = (req as IncomingMessage & { body?: unknown }).body;
  if (bodyFromFramework !== undefined) {
    if (typeof bodyFromFramework === 'string') {
      return bodyFromFramework;
    }
    return JSON.stringify(bodyFromFramework);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function jsonParseObject(rawBody: string): Record<string, unknown> {
  if (!rawBody) return {};

  const parsed: unknown = JSON.parse(rawBody);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Request JSON body must be an object');
  }

  return parsed as Record<string, unknown>;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function readBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function endpointPath(req: IncomingMessage): string {
  return parseUrl(req).pathname;
}

export class AnchorExpressRouter {
  private readonly config: AnchorConfig;
  private readonly database: DatabaseAdapter;
  private readonly webhookProcessor: WebhookProcessor;

  constructor(dependencies: RouterDependencies) {
    this.config = dependencies.config;
    this.database = dependencies.database;
    this.webhookProcessor = dependencies.webhookProcessor;
  }

  public getMiddleware(): ExpressLikeMiddleware {
    return (req, res, next) => {
      void this.handle(req, res).catch((error: unknown) => {
        if (next) {
          next(error);
          return;
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        sendJson(res, 500, {
          error: 'internal_server_error',
          message,
        });
      });
    };
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = endpointPath(req);
    const method = (req.method ?? 'GET').toUpperCase();

    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (method === 'GET' && path === '/info') {
      const fullConfig = this.config.getConfig();
      sendJson(res, 200, {
        name: fullConfig.operational?.name ?? 'Anchor-Kit Anchor',
        network: fullConfig.network.network,
        assets: fullConfig.assets.assets,
        version: 'mvp',
      });
      return;
    }

    if (method === 'GET' && path === '/auth/challenge') {
      const account = parseUrl(req).searchParams.get('account');
      if (!account) {
        sendJson(res, 400, {
          error: 'invalid_request',
          message: 'Query param account is required',
        });
        return;
      }

      const challenge = jwt.sign(
        {
          sub: account,
          nonce: randomUUID(),
          typ: 'sep10_challenge',
        },
        this.config.get('security').sep10SigningKey,
        { expiresIn: this.config.get('security').challengeExpirationSeconds ?? 300 },
      );

      const decoded = jwt.decode(challenge) as jwt.JwtPayload | null;
      const expiresAtSeconds = decoded?.exp;
      const expiresAt =
        typeof expiresAtSeconds === 'number'
          ? new Date(expiresAtSeconds * 1000).toISOString()
          : new Date(Date.now() + 300_000).toISOString();

      await this.database.insertAuthChallenge({
        id: randomUUID(),
        account,
        challenge,
        expiresAt,
      });

      sendJson(res, 200, {
        challenge,
        network_passphrase: this.config.get('network').networkPassphrase,
        expires_at: expiresAt,
      });
      return;
    }

    if (method === 'POST' && path === '/auth/token') {
      const rawBody = await readRawBody(req);
      const body = jsonParseObject(rawBody);
      const account = typeof body.account === 'string' ? body.account : '';
      const challenge = typeof body.challenge === 'string' ? body.challenge : '';

      if (!account || !challenge) {
        sendJson(res, 400, {
          error: 'invalid_request',
          message: 'Body must include account and challenge',
        });
        return;
      }

      try {
        jwt.verify(challenge, this.config.get('security').sep10SigningKey);
      } catch {
        sendJson(res, 401, {
          error: 'invalid_challenge',
          message: 'Challenge signature is invalid',
        });
        return;
      }

      const stored = await this.database.getAuthChallengeByChallenge(challenge);
      if (!stored || stored.account !== account) {
        sendJson(res, 401, { error: 'invalid_challenge', message: 'Challenge not found' });
        return;
      }

      if (stored.consumedAt) {
        sendJson(res, 401, { error: 'invalid_challenge', message: 'Challenge already used' });
        return;
      }

      if (new Date(stored.expiresAt).getTime() < Date.now()) {
        sendJson(res, 401, { error: 'invalid_challenge', message: 'Challenge expired' });
        return;
      }

      await this.database.markAuthChallengeConsumed(stored.id);

      const token = jwt.sign(
        {
          sub: account,
          scope: 'anchor_api',
          typ: 'access_token',
        },
        this.config.get('security').interactiveJwtSecret,
        { expiresIn: 3600 },
      );

      sendJson(res, 200, { token, expires_in: 3600 });
      return;
    }

    if (method === 'POST' && path === '/transactions/deposit/interactive') {
      const auth = this.authenticate(req);
      if (!auth) {
        sendJson(res, 401, { error: 'unauthorized', message: 'Missing or invalid bearer token' });
        return;
      }

      const rawBody = await readRawBody(req);
      const body = jsonParseObject(rawBody);
      const assetCode = typeof body.asset_code === 'string' ? body.asset_code : '';
      const amountRaw = body.amount;
      const amount =
        typeof amountRaw === 'string' || typeof amountRaw === 'number' ? `${amountRaw}` : '';

      if (!assetCode || !amount) {
        sendJson(res, 400, {
          error: 'invalid_request',
          message: 'Body must include asset_code and amount',
        });
        return;
      }

      const selectedAsset = this.config.getAsset(assetCode);
      if (!selectedAsset || selectedAsset.deposits_enabled === false) {
        sendJson(res, 400, { error: 'invalid_asset', message: 'Unsupported or disabled asset' });
        return;
      }

      const numericAmount = toNumber(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        sendJson(res, 400, {
          error: 'invalid_amount',
          message: 'Amount must be a positive number',
        });
        return;
      }

      const idempotencyKey = req.headers['idempotency-key'];
      const scope = `deposit:${auth.account}`;
      const requestHash = sha256(JSON.stringify({ assetCode, amount }));

      if (typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
        const existing = await this.database.getIdempotencyRecord(scope, idempotencyKey);
        if (existing) {
          if (existing.requestHash !== requestHash) {
            sendJson(res, 409, {
              error: 'idempotency_conflict',
              message: 'Idempotency key was already used with a different request body',
            });
            return;
          }

          sendJson(
            res,
            existing.statusCode,
            JSON.parse(existing.responseBody) as Record<string, unknown>,
          );
          return;
        }
      }

      const transactionId = randomUUID();
      const created = await this.database.insertInteractiveTransaction({
        id: transactionId,
        account: auth.account,
        kind: 'deposit',
        assetCode,
        amount,
        status: 'pending_user_transfer_start',
      });

      const response: JsonResponse = {
        status: 201,
        body: {
          id: created.id,
          kind: created.kind,
          status: created.status,
          amount: created.amount,
          asset_code: created.assetCode,
          interactive_url: `${this.config.get('server').interactiveDomain ?? 'http://localhost:3000'}/deposit/${created.id}`,
          created_at: created.createdAt,
        },
      };

      if (typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
        await this.database.insertIdempotencyRecord({
          id: randomUUID(),
          scope,
          idempotencyKey,
          requestHash,
          statusCode: response.status,
          responseBody: JSON.stringify(response.body),
        });
      }

      sendJson(res, response.status, response.body);
      return;
    }

    const transactionMatch = /^\/transactions\/([^/]+)$/.exec(path);
    if (method === 'GET' && transactionMatch) {
      const auth = this.authenticate(req);
      if (!auth) {
        sendJson(res, 401, { error: 'unauthorized', message: 'Missing or invalid bearer token' });
        return;
      }

      const transactionId = decodeURIComponent(transactionMatch[1]);
      const transaction = await this.database.getInteractiveTransactionById(transactionId);

      if (!transaction) {
        sendJson(res, 404, { error: 'not_found', message: 'Transaction not found' });
        return;
      }

      if (transaction.account !== auth.account) {
        sendJson(res, 403, {
          error: 'forbidden',
          message: 'Transaction belongs to another account',
        });
        return;
      }

      sendJson(res, 200, {
        id: transaction.id,
        kind: transaction.kind,
        status: transaction.status,
        amount: transaction.amount,
        asset_code: transaction.assetCode,
        account: transaction.account,
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
      });
      return;
    }

    if (method === 'POST' && path === '/webhooks/events') {
      const rawBody = await readRawBody(req);
      const payload = jsonParseObject(rawBody);
      const eventIdField = payload.id;
      const eventId =
        typeof eventIdField === 'string' && eventIdField.length > 0 ? eventIdField : randomUUID();
      const providerHeader = req.headers['x-webhook-provider'];
      const provider = typeof providerHeader === 'string' ? providerHeader : 'generic';
      const signatureHeader = req.headers['x-anchor-signature'];
      const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;

      try {
        const result = await this.webhookProcessor.process({
          eventId,
          provider,
          payload,
          signature,
        });

        sendJson(res, 200, {
          received: true,
          duplicate: result.duplicate,
          event_id: result.eventId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook processing failed';
        sendJson(res, 400, {
          error: 'webhook_error',
          message,
        });
      }
      return;
    }

    sendJson(res, 404, { error: 'not_found', message: 'Endpoint not found' });
  }

  private authenticate(req: IncomingMessage): AuthenticatedRequestData | null {
    const token = readBearerToken(req);
    if (!token) return null;

    try {
      const decoded = jwt.verify(
        token,
        this.config.get('security').interactiveJwtSecret,
      ) as jwt.JwtPayload;
      const account = typeof decoded.sub === 'string' ? decoded.sub : null;
      if (!account) {
        return null;
      }

      return { account };
    } catch {
      return null;
    }
  }
}
