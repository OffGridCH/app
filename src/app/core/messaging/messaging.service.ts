import { Injectable, type Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { AntennaPort } from '../antenna/antenna-port';
import { DeviceError } from '../antenna/device-error';
import { parseSendResult } from '../antenna/device-parse';
import { DataChangedService } from '../data/data-changed.service';
import { ContactRepository } from '../data/contact.repository';
import { CoordinateRepository } from '../data/coordinate.repository';
import { MessageRepository } from '../data/message.repository';
import { nowIso } from '../data/sqlite-mapping';
import { HandshakeService } from '../handshake/handshake.service';
import { log } from '../log';
import type { ContactListItem } from '../models/contact';
import type { DeliveryState, JsonObject, MessageStatusEvent, ReactionTarget, ReceivedMessage } from '../models/device';
import { MessageStatus, type GeoFix, type Message, type MessageKind } from '../models/message';
import { maxContentBytes, splitText } from './limits';
import { isReactionEmoji } from './reactions';
import { signalLevel } from './signal';

/** Eine eingehende Reaktion. Sie wird nicht gespeichert, sondern nur gemeldet. */
export interface ReactionEvent {
  contactId: number;
  /** Zähler der Reaktions-Nachricht. */
  ctr: number;
  target: ReactionTarget;
  /** `null`: der Kontakt hat seine Reaktion zurückgenommen. */
  emoji: string | null;
}

/** Wie `transmit` ausgegangen ist. */
type TransmitOutcome = 'handed-over' | 'waiting' | 'queue-full' | 'failed';

/** So viele Status-Ereignisse zu noch unbekannten Handles werden vorgehalten. */
const MAX_BUFFERED_REFS = 32;

/** Status des Geräts -> Status der App. `sent`, `relayed` und `retrying` zeigen alle ein Häkchen. */
function statusOf(state: DeliveryState): MessageStatus {
  switch (state) {
    case 'queued':
      return MessageStatus.Queued;
    case 'sent':
    case 'relayed':
    case 'retrying':
      return MessageStatus.Sent;
    case 'delivered':
      return MessageStatus.Delivered;
    case 'failed':
    case 'cancelled':
      return MessageStatus.Failed;
  }
}

/**
 * Sortiert die Kontaktliste: die Kontakte mit Nachricht kommen zuerst (neueste Nachricht vorne),
 * die Kontakte ohne Nachricht stehen nach ihrer Platznummer dahinter.
 */
function sortContactList(items: ContactListItem[]): ContactListItem[] {
  return [...items].sort((a, b) => {
    const first = a.lastMessage?.sentAt ?? null;
    const second = b.lastMessage?.sentAt ?? null;
    if (first !== null && second !== null) {
      if (first !== second) {
        return first < second ? 1 : -1;
      }
    } else if (first !== null) {
      return -1;
    } else if (second !== null) {
      return 1;
    }
    return a.contact.contactId - b.contact.contactId;
  });
}

/**
 * Senden und Empfangen von Nachrichten über die Host-API des Geräts.
 *
 * Die App verschlüsselt nichts und kennt keine Funkpakete: Sie schickt Klartext mit `msg.send` und bekommt
 * `msg.received` und `msg.status` zurück. Das Gerät erledigt Schlüssel, Zähler, Wiederholungen und Quittungen.
 *
 * Alle Änderungen laufen nacheinander (`run`), damit ein Status-Ereignis nie vor der Antwort auf `msg.send`
 * verarbeitet wird, die dem Handle erst seinen Zähler gibt.
 */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly antenna = inject(AntennaPort);
  private readonly contactRepository = inject(ContactRepository);
  private readonly messages = inject(MessageRepository);
  private readonly coordinates = inject(CoordinateRepository);
  private readonly handshake = inject(HandshakeService);
  private readonly dataChanged = inject(DataChangedService);
  private readonly reactionSubject = new Subject<ReactionEvent>();
  /** Status-Ereignisse, die vor dem Eintragen des Handles eintrafen. */
  private readonly unmatched = new Map<number, MessageStatusEvent[]>();
  private chain: Promise<void> = Promise.resolve();

  /** Die Kontaktliste mit letzter Nachricht, Ungelesenen und Signal-Level. */
  private readonly contactListSignal = signal<ContactListItem[]>([]);
  /** Die ungelesenen Nachrichten je Kontakt (aus der Kontaktliste). */
  private readonly unreadCounts = computed(() => {
    const counts = new Map<number, number>();
    for (const item of this.contactListSignal()) {
      counts.set(item.contact.contactId, item.unread);
    }
    return counts;
  });
  /** Die Signale der ungelesenen Nachrichten je Kontakt (werden nur einmal angelegt). */
  private readonly unreadSignalCache = new Map<number, Signal<number>>();
  /** Nummer des laufenden Reloads: nur das neueste Ergebnis wird übernommen. */
  private reloadToken = 0;

  /** Längster Text, den das Gerät in einer Nachricht annimmt (`limits.max_text_bytes`, meist 83). */
  readonly maxContentBytes = computed(() => maxContentBytes(this.antenna.limits().maxTextBytes));

  /**
   * Die Kontakte mit letzter Nachricht, Anzahl der ungelesenen Nachrichten und Signal-Level.
   *
   * Sortiert nach der letzten Nachricht (neueste zuerst); Kontakte ohne Nachricht stehen nach ihrer
   * Platznummer dahinter (Skill `offgrid-screens` §3).
   */
  readonly contacts: Signal<ContactListItem[]> = this.contactListSignal.asReadonly();

  /** Eingehende Reaktionen. */
  readonly reactions: Observable<ReactionEvent> = this.reactionSubject.asObservable();

  constructor() {
    this.antenna.events.subscribe((event) => {
      switch (event.evt) {
        case 'sys.boot':
          void this.run(() => this.onBoot());
          break;
        case 'msg.status':
          void this.run(() => this.onStatus(event.status));
          break;
        case 'msg.received':
          void this.run(() => this.onReceived(event.message));
          break;
        default:
          break;
      }
    });
    effect(() => {
      if (this.antenna.state() === 'unlocked') {
        untracked(() => void this.run(() => this.flush()));
      }
    });
    // Die Kontaktliste hängt an den Daten: bei jeder Änderung wird sie neu geladen.
    effect(() => {
      this.dataChanged.version();
      untracked(() => void this.reloadContacts());
    });
  }

  /**
   * Anzahl der ungelesenen Nachrichten eines Kontakts.
   *
   * Das Signal bleibt bestehen, wenn sich die Kontaktliste ändert: es liefert dann den neuen Wert.
   */
  unreadCount(contactId: number): Signal<number> {
    const cached = this.unreadSignalCache.get(contactId);
    if (cached !== undefined) {
      return cached;
    }
    const unread = computed(() => this.unreadCounts().get(contactId) ?? 0);
    this.unreadSignalCache.set(contactId, unread);
    return unread;
  }

  /**
   * Sendet einen Text. Ist er länger als `maxContentBytes()`, wird er geteilt und jeder Teil als eigene
   * Nachricht gesendet. Ist das Gerät nicht entsperrt, bleiben die Nachrichten in der Warteschlange.
   */
  sendText(contactId: number, text: string): Promise<void> {
    const parts = splitText(text, this.maxContentBytes());
    if (parts.length === 0) {
      return Promise.resolve();
    }
    return this.run(async () => {
      if (!(await this.contactRepository.byId(contactId))) {
        log.warn('Nachricht an unbekannten Kontakt', contactId);
        return;
      }
      for (const part of parts) {
        // Ist die Warteschlange des Geräts voll, bleibt der Teil gespeichert; `flush` schickt ihn später.
        await this.transmit(await this.store(contactId, 'text', part));
      }
    });
  }

  /** Sendet einen Standort als Nachricht (`type: "geo"`). */
  sendLocation(contactId: number, fix: GeoFix): Promise<void> {
    return this.run(async () => {
      if (!(await this.contactRepository.byId(contactId))) {
        log.warn('Standort an unbekannten Kontakt', contactId);
        return;
      }
      const message = await this.store(contactId, 'location', '');
      await this.coordinates.insert({
        id: crypto.randomUUID(),
        contactId,
        messageId: message.id,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        context: 'einmal',
        shareId: null,
        shareUntil: null,
        recordedAt: fix.at,
        createdAt: nowIso(),
        updatedAt: null,
      });
      await this.transmit(message);
    });
  }

  /**
   * Sendet eine Reaktion. `emoji = null` nimmt die eigene Reaktion zurück.
   *
   * Reaktionen werden nicht gewartet: Ist das Gerät nicht entsperrt oder lehnt es ab, ist das Ergebnis `false`.
   */
  async sendReaction(contactId: number, target: ReactionTarget, emoji: string | null): Promise<boolean> {
    if (emoji !== null && !isReactionEmoji(emoji)) {
      return false;
    }
    if (this.antenna.state() !== 'unlocked') {
      return false;
    }
    try {
      await this.antenna.request('msg.send', {
        to: contactId,
        type: 'reaction',
        target: { author: target.author, ref: target.ref },
        emoji,
      });
      return true;
    } catch (error) {
      log.warn('Reaktion nicht gesendet', error);
      return false;
    }
  }

  /** Sendet eine gescheiterte Nachricht noch einmal. */
  retry(messageId: string): Promise<void> {
    return this.run(async () => {
      const message = await this.messages.byId(messageId);
      if (!message || message.direction !== 'out' || message.status !== MessageStatus.Failed) {
        return;
      }
      await this.messages.requeue(message.id);
      this.dataChanged.notify();
      await this.transmit({ ...message, ctr: null, msgRef: null, status: MessageStatus.Queued });
    });
  }

  /** Bricht eine Nachricht ab, die noch nicht gesendet oder noch nicht quittiert ist (`msg.cancel`). */
  cancel(messageId: string): Promise<void> {
    return this.run(async () => {
      const message = await this.messages.byId(messageId);
      if (!message || message.direction !== 'out') {
        return;
      }
      if (message.msgRef === null) {
        if (message.status === MessageStatus.Queued) {
          await this.messages.setStatus(message.id, MessageStatus.Failed);
          this.dataChanged.notify();
        }
        return;
      }
      try {
        // Der Status `cancelled` kommt als Ereignis und macht die Nachricht zu „gescheitert“.
        await this.antenna.request('msg.cancel', { msg_ref: message.msgRef });
      } catch (error) {
        log.warn('Abbrechen nicht möglich', error);
      }
    });
  }

  /** Markiert die eingehenden Nachrichten eines Kontakts als gelesen. */
  async markRead(contactId: number): Promise<void> {
    await this.messages.markRead(contactId, nowIso());
    this.dataChanged.notify();
  }

  /**
   * Lädt die Kontaktliste neu: Kontakte, letzte Nachricht, ungelesene Nachrichten und Signal-Level.
   *
   * Das Signal-Level kommt aus dem RSSI des Kontakts und dem Zeitpunkt der letzten eingehenden Nachricht
   * (Skill `offgrid-screens` §0): ein Signal älter als 15 Minuten zählt nicht mehr.
   */
  private async reloadContacts(): Promise<void> {
    const token = ++this.reloadToken;
    try {
      const contacts = await this.contactRepository.all();
      const last = await this.messages.lastPerContact();
      const unread = await this.messages.unreadPerContact();
      const now = new Date();
      const items: ContactListItem[] = [];
      for (const contact of contacts) {
        const seenAt = await this.lastIncomingAt(contact.contactId);
        items.push({
          contact,
          lastMessage: last.get(contact.contactId) ?? null,
          unread: unread.get(contact.contactId) ?? 0,
          signalLevel: contact.state === 'pending' ? 0 : signalLevel(contact.lastRssi, seenAt, now),
        });
      }
      if (token !== this.reloadToken) {
        // Ein neueres Reload läuft bereits: dieses Ergebnis ist veraltet.
        return;
      }
      this.contactListSignal.set(sortContactList(items));
    } catch (error) {
      log.warn('Kontaktliste konnte nicht geladen werden', error);
    }
  }

  /** Zeitpunkt der letzten eingehenden Nachricht eines Kontakts (`null`, wenn es keine gibt). */
  private async lastIncomingAt(contactId: number): Promise<string | null> {
    const messages = await this.messages.forContact(contactId);
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message.direction === 'in') {
        return message.sentAt;
      }
    }
    return null;
  }

  private run(task: () => Promise<void>): Promise<void> {
    const next = this.chain.then(task).catch((error: unknown) => {
      log.error('Nachrichten-Verarbeitung fehlgeschlagen', error);
    });
    this.chain = next;
    return next;
  }

  private async store(contactId: number, kind: MessageKind, content: string): Promise<Message> {
    const now = nowIso();
    const message: Message = {
      id: crypto.randomUUID(),
      contactId,
      ctr: null,
      msgRef: null,
      content,
      direction: 'out',
      kind,
      sentAt: now,
      status: MessageStatus.Queued,
      rssi: null,
      readAt: null,
      createdAt: now,
      updatedAt: null,
    };
    await this.messages.insert(message);
    this.dataChanged.notify();
    return message;
  }

  /** Übergibt eine gespeicherte Nachricht an das Gerät (`msg.send`). */
  private async transmit(message: Message): Promise<TransmitOutcome> {
    if (this.antenna.state() !== 'unlocked') {
      return 'waiting';
    }
    try {
      const result = parseSendResult(await this.antenna.request('msg.send', await this.sendArgs(message)));
      await this.messages.assignRef(message.id, result.ctr, result.msgRef, MessageStatus.Queued);
      this.dataChanged.notify();
      for (const status of this.unmatched.get(result.msgRef) ?? []) {
        await this.applyStatus({ ...message, ctr: result.ctr, msgRef: result.msgRef }, status);
      }
      this.unmatched.delete(result.msgRef);
      return 'handed-over';
    } catch (error) {
      return this.onSendError(message, error);
    }
  }

  private async onSendError(message: Message, error: unknown): Promise<TransmitOutcome> {
    if (error instanceof DeviceError) {
      if (error.code === 'E_QUEUE_FULL') {
        return 'queue-full';
      }
      if (error.code === 'E_LOCKED') {
        return 'waiting';
      }
    }
    // Alles andere (zu lang, unbekannter Kontakt, keine Antwort) lässt sich nicht von selbst beheben.
    log.warn('msg.send fehlgeschlagen', error);
    await this.messages.setStatus(message.id, MessageStatus.Failed);
    this.dataChanged.notify();
    return 'failed';
  }

  private async sendArgs(message: Message): Promise<JsonObject> {
    if (message.kind === 'location') {
      const coordinate = await this.coordinates.latestForMessage(message.id);
      if (!coordinate) {
        throw new DeviceError('E_INVALID_ARG', 'Standort fehlt', 'lat');
      }
      const ageSeconds = Math.round((Date.now() - Date.parse(coordinate.recordedAt)) / 1000);
      return {
        to: message.contactId,
        type: 'geo',
        lat: coordinate.latitude,
        lon: coordinate.longitude,
        age_s: Math.min(2550, Math.max(0, ageSeconds)),
      };
    }
    return { to: message.contactId, type: 'text', text: message.content };
  }

  /** Schickt alles, was noch nicht beim Gerät ist, der Reihe nach. */
  private async flush(): Promise<void> {
    for (const message of await this.messages.queued()) {
      if (this.antenna.state() !== 'unlocked') {
        return;
      }
      const outcome = await this.transmit(message);
      if (outcome === 'queue-full' || outcome === 'waiting') {
        return;
      }
    }
  }

  /** Nach einem Neustart des Geräts ist seine Warteschlange leer: alles, was darin war, ist gescheitert. */
  private async onBoot(): Promise<void> {
    this.unmatched.clear();
    if ((await this.messages.failPending()) > 0) {
      this.dataChanged.notify();
    }
  }

  private async onStatus(status: MessageStatusEvent): Promise<void> {
    const message = await this.messages.byMsgRef(status.msgRef);
    if (!message) {
      this.buffer(status);
      return;
    }
    await this.applyStatus(message, status);
    if (statusOf(status.state) !== MessageStatus.Sent) {
      // Ein Platz in der Warteschlange des Geräts ist frei geworden.
      await this.flush();
    }
  }

  private async applyStatus(message: Message, status: MessageStatusEvent): Promise<void> {
    if (message.status === MessageStatus.Delivered || message.status === MessageStatus.Failed) {
      return;
    }
    const next = statusOf(status.state);
    if (next !== message.status) {
      await this.messages.setStatus(message.id, next);
      this.dataChanged.notify();
    }
  }

  private buffer(status: MessageStatusEvent): void {
    const entries = this.unmatched.get(status.msgRef) ?? [];
    entries.push(status);
    this.unmatched.set(status.msgRef, entries);
    if (this.unmatched.size > MAX_BUFFERED_REFS) {
      const oldest = this.unmatched.keys().next();
      if (!oldest.done) {
        this.unmatched.delete(oldest.value);
      }
    }
  }

  private async onReceived(received: ReceivedMessage): Promise<void> {
    if (received.type === 'reaction') {
      this.reactionSubject.next({
        contactId: received.from,
        ctr: received.ctr,
        target: received.target,
        emoji: received.emoji,
      });
      return;
    }
    const contact =
      (await this.contactRepository.byId(received.from)) ?? (await this.handshake.refreshContact(received.from));
    if (!contact) {
      log.warn('Nachricht von unbekanntem Kontakt', received.from);
      return;
    }
    // Das Gerät liefert eine Wiederholung nie ein zweites Mal aus; der Zähler schützt trotzdem vor Doppelten.
    if (await this.messages.byCtr(contact.contactId, 'in', received.ctr)) {
      return;
    }
    const now = nowIso();
    const message: Message = {
      id: crypto.randomUUID(),
      contactId: contact.contactId,
      ctr: received.ctr,
      msgRef: null,
      content: received.type === 'text' ? received.text : '',
      direction: 'in',
      kind: received.type === 'text' ? 'text' : 'location',
      sentAt: now,
      status: MessageStatus.Delivered,
      rssi: received.rssi,
      readAt: null,
      createdAt: now,
      updatedAt: null,
    };
    await this.messages.insert(message);
    if (received.type === 'geo') {
      await this.coordinates.insert({
        id: crypto.randomUUID(),
        contactId: contact.contactId,
        messageId: message.id,
        latitude: received.lat,
        longitude: received.lon,
        accuracy: null,
        context: 'einmal',
        shareId: null,
        shareUntil: null,
        recordedAt: new Date(Date.now() - (received.ageS ?? 0) * 1000).toISOString(),
        createdAt: now,
        updatedAt: null,
      });
    }
    await this.contactRepository.updateLink(contact.contactId, received.rssi, received.snr);
    this.dataChanged.notify();
  }
}
