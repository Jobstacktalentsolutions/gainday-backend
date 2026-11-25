import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const LOG_DIRECTORY = join(process.cwd(), 'logs');
const SECRET_KEY = /password|token|secret|authorization|cookie|api.?key/i;

type LogContext = string | Record<string, unknown> | undefined;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : redact(item),
    ]));
  }
  return value;
}

export class DevelopmentLogger implements LoggerService {
  private readonly consoleLogger = new ConsoleLogger();

  log(message: unknown, ...optionalParams: unknown[]) { this.write('log', message, optionalParams); this.consoleLogger.log(message, ...optionalParams); }
  error(message: unknown, ...optionalParams: unknown[]) { this.write('error', message, optionalParams); this.consoleLogger.error(message, ...optionalParams); }
  warn(message: unknown, ...optionalParams: unknown[]) { this.write('warn', message, optionalParams); this.consoleLogger.warn(message, ...optionalParams); }
  debug(message: unknown, ...optionalParams: unknown[]) { this.write('debug', message, optionalParams); this.consoleLogger.debug(message, ...optionalParams); }
  verbose(message: unknown, ...optionalParams: unknown[]) { this.write('verbose', message, optionalParams); this.consoleLogger.verbose(message, ...optionalParams); }
  fatal(message: unknown, ...optionalParams: unknown[]) { this.write('fatal', message, optionalParams); this.consoleLogger.fatal(message, ...optionalParams); }

  private write(level: string, message: unknown, optionalParams: unknown[]) {
    try {
      mkdirSync(LOG_DIRECTORY, { recursive: true });
      const file = join(LOG_DIRECTORY, `backend.dev.${new Date().toISOString().slice(0, 10)}.jsonl`);
      const context = optionalParams.find((param): param is LogContext => typeof param === 'string');
      const trace = optionalParams.find((param) => param instanceof Error);
      const record = {
        timestamp: new Date().toISOString(), level, service: 'gainday-backend',
        processId: process.pid, context, message: redact(message),
        ...(trace instanceof Error ? { stack: trace.stack } : {}),
      };
      appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
      const files = readdirSync(LOG_DIRECTORY)
        .filter((name) => /^backend\.dev\..+\.jsonl$/.test(name))
        .map((name) => ({ name, modified: statSync(join(LOG_DIRECTORY, name)).mtimeMs }))
        .sort((a, b) => b.modified - a.modified);
      for (const stale of files.slice(MAX_FILES)) unlinkSync(join(LOG_DIRECTORY, stale.name));
      if (statSync(file).size > MAX_FILE_BYTES) {
        const rotated = `${file}.${Date.now()}`;
        // Keep the active file bounded; older daily files are pruned by the retention cap.
        unlinkSync(file);
        appendFileSync(file, `${JSON.stringify({ ...record, message: 'Log file rotated after size limit' })}\n`, 'utf8');
        void rotated;
      }
    } catch (error) {
      process.stderr.write(`Development file logger failed: ${String(error)}\n`);
    }
  }
}
