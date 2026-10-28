// tests/unit/logger.test.js
import { describe, it, expect, vi } from 'vitest';
import { Logger, createLogger, redactSensitive, serializeError, LOG_LEVELS } from '../../src/utils/logger.js';

describe('Logger Unit Tests', () => {
  it('should define correct log levels hierarchy', () => {
    expect(LOG_LEVELS.trace).toBe(10);
    expect(LOG_LEVELS.debug).toBe(20);
    expect(LOG_LEVELS.info).toBe(30);
    expect(LOG_LEVELS.warn).toBe(40);
    expect(LOG_LEVELS.error).toBe(50);
    expect(LOG_LEVELS.fatal).toBe(60);
    expect(LOG_LEVELS.silent).toBe(100);
  });

  it('should redact sensitive fields recursively and handle Authorization headers', () => {
    const input = {
      username: 'john',
      password: 'super-secret-password',
      token: 'jwt-access-token',
      nested: {
        access_token: 'secret-nested-token',
        refresh_token: 'refresh-123',
        safeKey: 'hello',
      },
      headers: {
        authorization: 'Bearer token-12345',
      },
    };

    const redacted = redactSensitive(input);

    expect(redacted.username).toBe('john');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.access_token).toBe('[REDACTED]');
    expect(redacted.nested.refresh_token).toBe('[REDACTED]');
    expect(redacted.nested.safeKey).toBe('hello');
    expect(redacted.headers.authorization).toBe('Bearer [REDACTED]');
  });

  it('should handle circular references without crashing during redaction', () => {
    const obj = { name: 'circular-test' };
    obj.self = obj;

    const redacted = redactSensitive(obj);
    expect(redacted.name).toBe('circular-test');
    expect(redacted.self).toBe('[Circular]');
  });

  it('should serialize Error objects cleanly', () => {
    const err = new Error('Test failure');
    err.code = 'NOT_FOUND';
    err.status = 404;

    const serialized = serializeError(err);
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('Test failure');
    expect(serialized.code).toBe('NOT_FOUND');
    expect(serialized.status).toBe(404);
    expect(serialized.stack).toBeDefined();
  });

  it('should respect log level filtering and output JSON format', () => {
    const logs = [];
    const destination = {
      write: (str) => logs.push(str),
    };

    const logger = new Logger({
      level: 'warn',
      format: 'json',
      destination,
      pid: 1234,
    });

    logger.debug('debug message should be ignored');
    logger.info('info message should be ignored');
    logger.warn({ detail: 'be careful' }, 'warning message');
    logger.error('error message');

    expect(logs.length).toBe(2);

    const warnEntry = JSON.parse(logs[0]);
    expect(warnEntry.level).toBe('warn');
    expect(warnEntry.msg).toBe('warning message');
    expect(warnEntry.detail).toBe('be careful');
    expect(warnEntry.pid).toBe(1234);

    const errorEntry = JSON.parse(logs[1]);
    expect(errorEntry.level).toBe('error');
    expect(errorEntry.msg).toBe('error message');
  });

  it('should create child logger with merged bindings', () => {
    const logs = [];
    const destination = {
      write: (str) => logs.push(str),
    };

    const rootLogger = new Logger({
      level: 'info',
      format: 'json',
      destination,
      bindings: { service: 'inventory' },
    });

    const childLogger = rootLogger.child({ requestId: 'req-abc-123' });
    childLogger.info({ action: 'create_asset' }, 'Asset created');

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.service).toBe('inventory');
    expect(entry.requestId).toBe('req-abc-123');
    expect(entry.action).toBe('create_asset');
    expect(entry.msg).toBe('Asset created');
  });
});

