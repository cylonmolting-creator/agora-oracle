/**
 * Structured Logger
 *
 * Centralized logging with JSON output for production monitoring.
 * In development mode, logs are pretty-printed for readability.
 */

const isDev = process.env.NODE_ENV === 'development';

const logger = {
  info: (msg, meta = {}) => {
    const logData = { level: 'info', msg, ...meta, timestamp: new Date().toISOString() };
    if (isDev) {
      console.log(`[INFO] ${msg}`, Object.keys(meta).length > 0 ? meta : '');
    } else {
      console.log(JSON.stringify(logData));
    }
  },
  error: (msg, meta = {}) => {
    const logData = { level: 'error', msg, ...meta, timestamp: new Date().toISOString() };
    if (isDev) {
      console.error(`[ERROR] ${msg}`, Object.keys(meta).length > 0 ? meta : '');
    } else {
      console.error(JSON.stringify(logData));
    }
  },
  warn: (msg, meta = {}) => {
    const logData = { level: 'warn', msg, ...meta, timestamp: new Date().toISOString() };
    if (isDev) {
      console.warn(`[WARN] ${msg}`, Object.keys(meta).length > 0 ? meta : '');
    } else {
      console.warn(JSON.stringify(logData));
    }
  }
};

export default logger;
