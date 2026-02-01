/**
 * Sistema de logging simple
 * Principio: Single Responsibility - Solo maneja el logging
 */
class Logger {
  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, ...args);
  }

  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }
}

export const logger = new Logger();
