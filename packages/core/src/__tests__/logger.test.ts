/**
 * Tests for the structured logger
 */

import { describe, it, expect } from 'vitest';
import { Logger, logger, withContext, getContext, getCorrelationId, addContext, redactSensitive } from '../logger';

describe('Logger', () => {
  it('should create a logger with default configuration', () => {
    const testLogger = new Logger({
      service: 'test-service',
      level: 'info',
      prettyPrint: false,
    });
    
    expect(testLogger).toBeDefined();
    expect(testLogger.raw).toBeDefined();
  });

  it('should have all log methods available', () => {
    const testLogger = new Logger({
      service: 'test-service',
      level: 'trace',
      prettyPrint: false,
    });
    
    expect(typeof testLogger.trace).toBe('function');
    expect(typeof testLogger.debug).toBe('function');
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.error).toBe('function');
    expect(typeof testLogger.fatal).toBe('function');
  });

  it('should create child loggers with additional context', () => {
    const testLogger = new Logger({
      service: 'test-service',
      level: 'info',
      prettyPrint: false,
    });
    
    const childLogger = testLogger.child({ component: 'auth' });
    
    expect(childLogger).toBeDefined();
    expect(childLogger.raw).toBeDefined();
  });

  it('should handle error objects without throwing', () => {
    const testLogger = new Logger({
      service: 'test-service',
      level: 'info',
      prettyPrint: false,
    });
    
    const error = new Error('Test error');
    
    expect(() => {
      testLogger.error('Something went wrong', error);
    }).not.toThrow();
  });
});

describe('Logger Context', () => {
  it('should propagate correlation context through async operations', async () => {
    const correlationId = 'test-correlation-123';
    let capturedContext: any;
    
    await withContext(
      { correlationId, userId: 'user456' },
      async () => {
        capturedContext = getContext();
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Context should still be available
        expect(getCorrelationId()).toBe(correlationId);
      }
    );
    
    expect(capturedContext).toBeDefined();
    expect(capturedContext!.correlationId).toBe(correlationId);
    expect(capturedContext!.userId).toBe('user456');
  });

  it('should add context to existing context', async () => {
    const correlationId = 'test-correlation-456';
    let capturedContext: any;
    
    await withContext({ correlationId }, async () => {
      await addContext({ operation: 'test', requestId: 'req-123' }, async () => {
        capturedContext = getContext();
      });
    });
    
    expect(capturedContext!.correlationId).toBe(correlationId);
    expect(capturedContext!.operation).toBe('test');
    expect(capturedContext!.requestId).toBe('req-123');
  });

  it('should generate correlation IDs when not provided', async () => {
    let capturedContext: any;
    
    await withContext({ userId: 'user789' }, async () => {
      capturedContext = getContext();
    });
    
    expect(capturedContext).toBeDefined();
    expect(capturedContext!.correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/);
    expect(capturedContext!.userId).toBe('user789');
  });
});

describe('Logger Redaction', () => {
  it('should redact sensitive fields in objects', () => {
    const data = {
      username: 'john.doe',
      password: 'secret123',
      email: 'john@example.com',
      apiKey: 'sk-1234567890',
      nested: {
        token: 'abc123',
        safe: 'value',
      },
    };
    
    const redacted = redactSensitive(data, {
      fields: ['password', 'token', 'apiKey'],
    });
    
    expect(redacted).toEqual({
      username: 'john.doe',
      password: '[REDACTED]',
      email: 'john@example.com',
      apiKey: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
        safe: 'value',
      },
    });
  });

  it('should handle arrays with sensitive data', () => {
    const data = [
      { name: 'Item 1', secret: 'hidden1' },
      { name: 'Item 2', secret: 'hidden2' },
    ];
    
    const redacted = redactSensitive(data, { fields: ['secret'] });
    
    expect(redacted).toEqual([
      { name: 'Item 1', secret: '[REDACTED]' },
      { name: 'Item 2', secret: '[REDACTED]' },
    ]);
  });

  it('should partially redact strings when requested', () => {
    const data = {
      creditCard: '1234567890123456',
    };
    
    const redacted = redactSensitive(data, {
      fields: ['creditCard'],
      partial: true,
    });
    
    expect(redacted.creditCard).toBe('1234********3456');
  });

  it('should use custom replacement string', () => {
    const data = {
      password: 'secret123',
    };
    
    const redacted = redactSensitive(data, {
      fields: ['password'],
      replacement: '***HIDDEN***',
    });
    
    expect(redacted.password).toBe('***HIDDEN***');
  });

  it('should handle null and undefined values', () => {
    const data = {
      password: null,
      token: undefined,
      safe: 'value',
    };
    
    const redacted = redactSensitive(data, { fields: ['password', 'token'] });
    
    expect(redacted).toEqual({
      password: null,
      token: undefined,
      safe: 'value',
    });
  });
});

describe('Default Logger', () => {
  it('should export a default logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should use environment variables for configuration', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalLogLevel = process.env.LOG_LEVEL;
    
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'debug';
    
    const testLogger = new Logger();
    expect(testLogger).toBeDefined();
    
    // Restore environment
    process.env.NODE_ENV = originalEnv;
    process.env.LOG_LEVEL = originalLogLevel;
  });
});
