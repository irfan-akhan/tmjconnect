import pino from 'pino';

export type Logger = pino.Logger;

/**
 * Creates a structured pino logger.
 *
 * - Production: plain JSON to stdout, captured by the systemd journal.
 * - Development: pretty-printed with pino-pretty for human readability.
 * - HIPAA: redact sensitive fields from all log output. PHI values (notes, description)
 *   must never be passed to the logger directly.
 */
export function createLogger(nodeEnv: string, level: string): Logger {
  return pino({
    level,
    // pino-pretty transport for development only.
    // Production must use plain JSON for structured log parsing.
    transport:
      nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    // Redact sensitive fields from all log entries.
    // HIPAA: never log passwords, tokens, MFA codes, or auth headers.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.new_password',
        'req.body.current_password',
        'req.body.code',
        'req.body.token',
        'req.body.mfa_token',
        'req.body.refresh_token',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
  });
}
