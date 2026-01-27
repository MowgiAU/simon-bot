import pino from 'pino';

/**
 * Logger factory - creates consistent loggers for bot and plugins
 */
export class Logger {
  private logger: pino.Logger;

  constructor(context: string) {
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
    this.logger.error(error, msg);
  }
}
