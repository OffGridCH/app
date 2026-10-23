import { isDevMode } from '@angular/core';

export const log = {
  debug(...values: unknown[]): void {
    if (isDevMode()) {
      console.debug(...values);
    }
  },

  info(...values: unknown[]): void {
    if (isDevMode()) {
      console.info(...values);
    }
  },

  warn(...values: unknown[]): void {
    console.warn(...values);
  },

  error(...values: unknown[]): void {
    console.error(...values);
  },
};
