import type { AntennaErrorCode } from '../models/antenna';

/** Fehler beim Öffnen der Verbindung zur Antenne. `code` sagt der Oberfläche, was sie anzeigen soll. */
export class TransportError extends Error {
  constructor(
    readonly code: Extract<AntennaErrorCode, 'no-device' | 'permission-denied' | 'open-failed'>,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Die Leitung zur Antenne: Text hinein, Text heraus.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: Android spricht über das USB-Serial-Plugin (T06),
 * der Browser über den simulierten Geräte-Mock. Der Transport kennt weder JSON noch Befehle.
 */
export abstract class SerialTransport {
  /**
   * Öffnet die Verbindung (115200 Baud, 8N1, kein Flow Control).
   *
   * Setzt **DTR und RTS sofort nach dem Öffnen auf low**, sonst setzt der ESP32 sich zurück.
   * Wirft `TransportError`, wenn kein Gerät da ist, die Berechtigung fehlt oder das Öffnen scheitert.
   */
  abstract open(): Promise<void>;

  /** Schreibt Text (UTF-8) auf die Leitung. */
  abstract write(text: string): Promise<void>;

  /** Schliesst die Verbindung. Mehrfach aufrufbar. */
  abstract close(): Promise<void>;

  /**
   * Setzt die Funktion für empfangenen Text. Die Stücke dürfen beliebig geschnitten sein,
   * Mehrbyte-Zeichen müssen aber ganz sein (UTF-8-Decoder mit Zustand im Transport).
   */
  abstract onData(handler: (chunk: string) => void): void;

  /** Setzt die Funktion, die aufgerufen wird, wenn die Verbindung von aussen endet (Kabel gezogen). */
  abstract onClosed(handler: () => void): void;
}
