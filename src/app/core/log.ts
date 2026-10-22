import { environment } from '../../environments/environment';

/**
 * Einziger Ort für Konsolenausgaben. `debug` und `info` schreiben nur ausserhalb
 * der Produktion, `warn` und `error` immer.
 */
export const log = {
  debug(...args: unknown[]): void {
    if (!environment.production) {
      console.debug(...args);
    }
  },
  info(...args: unknown[]): void {
    if (!environment.production) {
      console.info(...args);
    }
  },
  warn(...args: unknown[]): void {
    console.warn(...args);
  },
  error(...args: unknown[]): void {
    console.error(...args);
  },
};
