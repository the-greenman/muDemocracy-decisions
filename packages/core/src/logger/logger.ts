/**
 * Structured logger with correlation context and redaction
 */

import pino, { type Logger as PinoLogger } from 'pino';
import type { LogContext, LoggerConfig, LogLevel } from './types.js';
import { DEFAULT_REDACT_FIELDS } from './types.js';
import { getContext, getCorrelationId } from './context.js';

export class Logger {
  private pino: PinoLogger;
  private serviceName: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    const {
      level = 'info',
      prettyPrint = process.env.NODE_ENV !== 'production',
      redactFields = DEFAULT_REDACT_FIELDS,
      service = 'decision-logger',
    } = config;

    this.serviceName = service;

    const pinoConfig: pino.LoggerOptions = {
      level,
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (object: any) => {
          // Add correlation context if available
          const correlationId = getCorrelationId();
          if (correlationId) {
            object.correlationId = correlationId;
          }
          
          // Add service name
          object.service = this.serviceName;
          
          // Add timestamp if not present
          if (!object.timestamp) {
            object.timestamp = new Date().toISOString();
          }
          
          return object;
        },
      },
      redact: {
        paths: redactFields.map(field => `*.${field}`),
        censor: '[REDACTED]',
      },
    };

    if (prettyPrint) {
      pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      };
    }

    this.pino = pino(pinoConfig);
  }

  /**
   * Creates a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childPino = this.pino.child(context);
    const childLogger = Object.create(Logger.prototype);
    childLogger.pino = childPino;
    childLogger.serviceName = this.serviceName;
    return childLogger;
  }

  /**
   * Logs at fatal level
   */
  fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }

  /**
   * Logs at error level
   */
  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.pino.error(error, message, context);
    } else {
      this.log('error', message, error as LogContext);
    }
  }

  /**
   * Logs at warn level
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Logs at info level
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Logs at debug level
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Logs at trace level
   */
  trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const currentContext = getContext() || {};
    const mergedContext = { ...currentContext, ...context };
    
    this.pino[level](mergedContext, message);
  }

  /**
   * Gets the underlying Pino logger instance
   */
  get raw(): PinoLogger {
    return this.pino;
  }
}

// Default logger instance
export const logger = new Logger({
  service: 'decision-logger',
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
});
