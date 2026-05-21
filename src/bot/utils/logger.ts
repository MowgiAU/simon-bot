import pino from 'pino';
import fs from 'fs';
import path from 'path';

/**
 * Logger factory - creates consistent loggers for bot and plugins
 */
export class Logger {
  private logger: pino.Logger;

  constructor(context: string, options?: { logFile?: string }) {
    if (options?.logFile) {
      // Write to a dedicated log file only — keeps it out of the main pm2 log stream
      const dir = path.dirname(options.logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.logger = pino(
        { level: process.env.LOG_LEVEL || 'info' },
        pino.destination({ dest: options.logFile, sync: false, append: true })
      ).child({ context });
    } else {
      this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          singleLine: false,
          sync: true,
        },
      },
    }).child({ context });
    }
  }

  debug(msg: string, data?: any) {
    this.logger.debug(data, msg);
  }

  info(msg: string, data?: any) {
    this.logger.info(data, msg);
  }

  warn(msg: string, data?: any) {
    this.logger.warn(data, msg);
  }

  error(msg: string, error?: any) {
    if (error && typeof error === 'object') {
      // Axios errors include the full request object which produces enormous log entries.
      // Reduce to just the useful parts before handing to Pino.
      const sanitized: any = {
        type: error.constructor?.name || 'Error',
        message: error.message,
        stack: error.stack,
      };
      if (error.response) {
        sanitized.status = error.response.status;
        sanitized.data = error.response.data;
      }
      if (error.code) sanitized.code = error.code;
      this.logger.error({ err: sanitized }, msg);
    } else {
      this.logger.error(error, msg);
    }
  }
}
