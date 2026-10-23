import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { AntennaPort } from '../antenna/antenna-port';
import { DeviceError } from '../antenna/device-error';
import { parseContact, parseContactList, parsePairBegin } from '../antenna/device-parse';
import { fromBase64 } from '../crypto/base64';
import { ContactRepository } from '../data/contact.repository';
import { DataChangedService } from '../data/data-changed.service';
import { log } from '../log';
import type { Contact } from '../models/contact';
import type { DeviceEvent } from '../models/device';
import type { HandshakeErrorCode } from '../models/handshake';
import { isValidDisplayName } from '../messaging/limits';

/** QR-Text: Base64 von `"OG1" || public_key (32) || salt (16) || name`. Mindestlänge ohne Namen: 51 Bytes. */
const QR_MAGIC = 'OG1';
const QR_MIN_BYTES = 3 + 32 + 16;

/** Grösse einer Seite von `contact.list` (Höchstwert laut Vertrag). */
const LIST_PAGE = 10;

/** Prüft, ob ein gescanntes Ding wie ein OffGrid-Code aussieht. Alles Weitere prüft das Gerät. */
export function looksLikeOffgridQr(text: string): boolean {
  try {
    const bytes = fromBase64(text.trim());
    return bytes.length >= QR_MIN_BYTES && new TextDecoder().decode(bytes.slice(0, 3)) === QR_MAGIC;
  } catch {
    return false;
  }
}

/**
 * Kontakte hinzufügen und spiegeln.
 *
 * Das Pairing macht das Gerät: `pair.begin` liefert den QR-Text für den eigenen Code, `pair.complete`
 * verarbeitet den gescannten Code, leitet die Schlüssel ab und liefert den Kontakt samt Fingerabdruck.
 * Die Schlüssel sehen wir nie. Beide Seiten zeigen ihren Code und scannen den des anderen; der Kontakt ist
 * `pending`, bis das erste gültige Paket des Gegenübers eintrifft (Ereignis `contact.state`).
 */
@Injectable({ providedIn: 'root' })
export class HandshakeService {
  private readonly antenna = inject(AntennaPort);
  private readonly contacts = inject(ContactRepository);
  private readonly dataChanged = inject(DataChangedService);

  private readonly qrTextSignal = signal<string | null>(null);
  private readonly qrExpiresAtSignal = signal<number | null>(null);
  private readonly errorSignal = signal<HandshakeErrorCode | null>(null);
  private readonly completedSignal = signal<number | null>(null);

  /** Text für den eigenen QR-Code, solange einer offen ist. */
  readonly qrText = this.qrTextSignal.asReadonly();
  /** Zeitpunkt (ms seit 1970), an dem der QR-Code abläuft. */
  readonly qrExpiresAt = this.qrExpiresAtSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  /** Platz des Kontakts, der gerade hinzugefügt wurde (die Seite wechselt dann zu „Kontakt benennen“). */
  readonly completedContactId = this.completedSignal.asReadonly();

  constructor() {
    this.antenna.events.subscribe((event) => void this.onEvent(event));
    effect(() => {
      if (this.antenna.state() === 'unlocked') {
        untracked(() => void this.syncContacts());
      }
    });
  }

  /** Beginnt ein Pairing und liefert den Text für den eigenen QR-Code (`pair.begin`). */
  async begin(): Promise<string | null> {
    this.errorSignal.set(null);
    this.completedSignal.set(null);
    if (this.antenna.state() !== 'unlocked') {
      this.errorSignal.set('antenna-not-ready');
      return null;
    }
    try {
      const result = parsePairBegin(await this.antenna.request('pair.begin'));
      this.qrTextSignal.set(result.qr);
      this.qrExpiresAtSignal.set(Date.now() + result.expiresS * 1000);
      return result.qr;
    } catch (error) {
      this.errorSignal.set(this.errorCodeOf(error));
      return null;
    }
  }

  /** Verwirft das offene Pairing (`pair.cancel`). */
  async cancel(): Promise<void> {
    this.qrTextSignal.set(null);
    this.qrExpiresAtSignal.set(null);
    if (this.antenna.state() !== 'unlocked') {
      return;
    }
    try {
      await this.antenna.request('pair.cancel');
    } catch (error) {
      log.warn('pair.cancel fehlgeschlagen', error);
    }
  }

  /**
   * Verarbeitet den gescannten Code des Gegenübers (`pair.complete`).
   *
   * @returns der neue Kontakt (`pending`, mit Fingerabdruck) oder `null`; dann steht der Grund in `error`
   */
  async complete(qrText: string, options: { name?: string; replace?: boolean } = {}): Promise<Contact | null> {
    this.errorSignal.set(null);
    if (!looksLikeOffgridQr(qrText)) {
      this.errorSignal.set('invalid-qr');
      return null;
    }
    if (this.antenna.state() !== 'unlocked') {
      this.errorSignal.set('antenna-not-ready');
      return null;
    }
    try {
      const result = await this.antenna.request('pair.complete', {
        qr: qrText.trim(),
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.replace === true ? { replace: true } : {}),
      });
      const contact = parseContact(result['contact']);
      await this.mirror(contact);
      this.qrTextSignal.set(null);
      this.qrExpiresAtSignal.set(null);
      this.completedSignal.set(contact.contactId);
      this.dataChanged.notify();
      return contact;
    } catch (error) {
      this.errorSignal.set(this.errorCodeOf(error));
      return null;
    }
  }

  /** Setzt `completedContactId` zurück (die Seite „Kontakt benennen“ ruft das beim Öffnen auf). */
  clearCompleted(): void {
    this.completedSignal.set(null);
  }

  /** Holt alle Kontakte vom Gerät und gleicht die lokale Kopie ab (`contact.list`). */
  async syncContacts(): Promise<void> {
    if (this.antenna.state() !== 'unlocked') {
      return;
    }
    try {
      let offset = 0;
      let total = 1;
      while (offset < total) {
        const page = parseContactList(
          await this.antenna.request('contact.list', { offset, limit: LIST_PAGE }),
        );
        total = page.total;
        for (const contact of page.contacts) {
          await this.mirror(contact);
        }
        if (page.contacts.length === 0) {
          break;
        }
        offset += page.contacts.length;
      }
      this.dataChanged.notify();
    } catch (error) {
      log.warn('Kontakte konnten nicht abgeglichen werden', error);
    }
  }

  /** Holt einen Kontakt vom Gerät (`contact.get`) und speichert ihn. `null`, wenn er dort nicht existiert. */
  async refreshContact(contactId: number): Promise<Contact | null> {
    if (this.antenna.state() !== 'unlocked') {
      return null;
    }
    try {
      const result = await this.antenna.request('contact.get', { contact_id: contactId });
      const contact = parseContact(result['contact']);
      await this.mirror(contact);
      this.dataChanged.notify();
      return contact;
    } catch (error) {
      log.warn('Kontakt konnte nicht geholt werden', error);
      return null;
    }
  }

  /** Benennt einen Kontakt um (`contact.rename`, 1–24 Bytes). */
  async rename(contactId: number, name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!isValidDisplayName(trimmed)) {
      return false;
    }
    try {
      await this.antenna.request('contact.rename', { contact_id: contactId, name: trimmed });
      await this.contacts.updateName(contactId, trimmed);
      this.dataChanged.notify();
      return true;
    } catch (error) {
      log.warn('Umbenennen fehlgeschlagen', error);
      return false;
    }
  }

  /** Löscht einen Kontakt auf dem Gerät (Schlüssel, Zähler) und lokal samt Verlauf (`contact.delete`). */
  async remove(contactId: number): Promise<boolean> {
    try {
      await this.antenna.request('contact.delete', { contact_id: contactId, confirm: true });
    } catch (error) {
      if (!(error instanceof DeviceError && error.code === 'E_NO_SUCH_CONTACT')) {
        log.warn('Löschen fehlgeschlagen', error);
        return false;
      }
    }
    await this.contacts.delete(contactId);
    this.dataChanged.notify();
    return true;
  }

  /**
   * Speichert einen Kontakt des Geräts lokal.
   *
   * Hat der Platz auf dem Gerät inzwischen einen anderen Schlüssel (Gerät zurückgesetzt, Platz neu vergeben),
   * gehört der alte Verlauf nicht mehr zu diesem Kontakt und wird mit ihm gelöscht.
   */
  private async mirror(contact: Contact): Promise<void> {
    const existing = await this.contacts.byId(contact.contactId);
    if (existing && existing.publicKey !== contact.publicKey) {
      await this.contacts.delete(contact.contactId);
    }
    await this.contacts.upsert(contact);
  }

  private async onEvent(event: DeviceEvent): Promise<void> {
    if (event.evt !== 'contact.state') {
      return;
    }
    if (await this.contacts.byId(event.contactId)) {
      await this.contacts.setState(event.contactId, event.state);
      this.dataChanged.notify();
    } else {
      await this.refreshContact(event.contactId);
    }
  }

  private errorCodeOf(error: unknown): HandshakeErrorCode {
    if (error instanceof DeviceError) {
      switch (error.code) {
        case 'E_NO_PAIRING':
          return 'no-pairing';
        case 'E_INVALID_QR':
          return 'invalid-qr';
        case 'E_SELF_PAIR':
          return 'self-pair';
        case 'E_CONTACT_EXISTS':
          return 'contact-exists';
        case 'E_STORAGE_FULL':
          return 'storage-full';
        case 'E_LOCKED':
        case 'E_DISCONNECTED':
        case 'E_TIMEOUT':
          return 'antenna-not-ready';
        default:
          return 'pairing-failed';
      }
    }
    return 'pairing-failed';
  }
}
