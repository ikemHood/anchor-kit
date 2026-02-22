export abstract class AnchorKitError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
  }

  toJSON() {
    return {
      error: this.errorCode,
      message: this.message,
      ...(typeof globalThis.process !== 'undefined' &&
        globalThis.process.env?.NODE_ENV === 'development' && { context: this.context }),
    };
  }
}

export class ConfigurationError extends AnchorKitError {
  public readonly statusCode = 500;
  public readonly errorCode = 'INVALID_CONFIG';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}
