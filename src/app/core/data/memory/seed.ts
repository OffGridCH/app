import type { CryptoService } from '../../crypto/crypto.service';
import type { Contact } from '../../models/contact';
import type { Handshake } from '../../models/handshake';
import { MessageStatus, type Message } from '../../models/message';

/** Demo-Daten für den Browser (Demo-Verlauf laut `offgrid-screens` §6). */
export interface DemoData {
  contacts: Contact[];
  messages: Message[];
  handshakes: Handshake[];
  settings: Record<string, string>;
}

const ZONE = 'Europe/Zurich';

const zoneFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Zerlegt einen Zeitpunkt in seine Bestandteile in der Zeitzone der App. */
function zoneParts(date: Date): ZoneParts {
  const parts = zoneFormat.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/** Zeitpunkt für eine Ortszeit in der Zeitzone der App. */
function zonedTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const probe = zoneParts(new Date(asUtc));
  const probeAsUtc = Date.UTC(probe.year, probe.month - 1, probe.day, probe.hour, probe.minute, probe.second);
  return new Date(asUtc - (probeAsUtc - asUtc));
}

/** Gestern um die gegebene Ortszeit. */
function yesterdayAt(hour: number, minute: number, now: Date): Date {
  const local = zoneParts(now);
  const yesterday = new Date(Date.UTC(local.year, local.month - 1, local.day - 1));
  return zonedTime(yesterday.getUTCFullYear(), yesterday.getUTCMonth() + 1, yesterday.getUTCDate(), hour, minute);
}

/**
 * Erzeugt die Demo-Daten: drei Kontakte mit Verlauf und ein offener Handshake.
 * Die Schlüssel der Demo-Kontakte werden neu erzeugt.
 */
export function createDemoData(cryptoService: CryptoService, now: Date = new Date()): DemoData {
  const minutesAgo = (minutes: number): string => new Date(now.getTime() - minutes * 60_000).toISOString();
  const daysAgo = (days: number): string => new Date(now.getTime() - days * 86_400_000).toISOString();

  const anna: Contact = {
    id: crypto.randomUUID(),
    sendingKey: cryptoService.newKey(),
    receivingKey: cryptoService.newKey(),
    displayName: 'Anna Meier',
    firstName: 'Anna',
    lastName: 'Meier',
    handshakeAt: daysAgo(1),
    lastRssi: -92,
    lastSeenAt: minutesAgo(1),
    createdAt: daysAgo(1),
    updatedAt: null,
  };

  const luca: Contact = {
    id: crypto.randomUUID(),
    sendingKey: cryptoService.newKey(),
    receivingKey: cryptoService.newKey(),
    displayName: 'Luca Bernasconi',
    firstName: 'Luca',
    lastName: 'Bernasconi',
    handshakeAt: daysAgo(2),
    lastRssi: -100,
    lastSeenAt: minutesAgo(5),
    createdAt: daysAgo(2),
    updatedAt: null,
  };

  const mia: Contact = {
    id: crypto.randomUUID(),
    sendingKey: cryptoService.newKey(),
    receivingKey: cryptoService.newKey(),
    displayName: 'Mia Frei',
    firstName: 'Mia',
    lastName: 'Frei',
    handshakeAt: daysAgo(3),
    lastRssi: -110,
    lastSeenAt: yesterdayAt(19, 12, now).toISOString(),
    createdAt: daysAgo(3),
    updatedAt: null,
  };

  const annaRead = minutesAgo(12);
  const messages: Message[] = [
    {
      id: crypto.randomUUID(),
      contactId: anna.id,
      wireId: cryptoService.randomHex(4),
      content: 'Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.',
      direction: 'in',
      kind: 'text',
      sentAt: annaRead,
      status: MessageStatus.Delivered,
      rssi: -92,
      readAt: annaRead,
      createdAt: annaRead,
      updatedAt: null,
    },
    {
      id: crypto.randomUUID(),
      contactId: anna.id,
      wireId: cryptoService.randomHex(4),
      content: 'Wir sind bei der Hütte und kommen in etwa 20 Minuten.',
      direction: 'out',
      kind: 'text',
      sentAt: minutesAgo(11),
      status: MessageStatus.Delivered,
      rssi: null,
      readAt: null,
      createdAt: minutesAgo(11),
      updatedAt: null,
    },
    {
      id: crypto.randomUUID(),
      contactId: anna.id,
      wireId: cryptoService.randomHex(4),
      content: 'Wartest du dort auf uns?',
      direction: 'out',
      kind: 'text',
      sentAt: minutesAgo(9),
      status: MessageStatus.Sent,
      rssi: null,
      readAt: null,
      createdAt: minutesAgo(9),
      updatedAt: null,
    },
    {
      id: crypto.randomUUID(),
      contactId: anna.id,
      wireId: cryptoService.randomHex(4),
      content: 'Ja, ich warte hier. Es ist ziemlich windig.',
      direction: 'in',
      kind: 'text',
      sentAt: minutesAgo(2),
      status: MessageStatus.Delivered,
      rssi: -92,
      readAt: null,
      createdAt: minutesAgo(2),
      updatedAt: null,
    },
    {
      id: crypto.randomUUID(),
      contactId: luca.id,
      wireId: cryptoService.randomHex(4),
      content: 'Basislager erreicht.',
      direction: 'in',
      kind: 'text',
      sentAt: minutesAgo(180),
      status: MessageStatus.Delivered,
      rssi: -100,
      readAt: minutesAgo(180),
      createdAt: minutesAgo(180),
      updatedAt: null,
    },
    {
      id: crypto.randomUUID(),
      contactId: mia.id,
      wireId: cryptoService.randomHex(4),
      content: 'Wir starten morgen um 7 Uhr.',
      direction: 'out',
      kind: 'text',
      sentAt: yesterdayAt(19, 12, now).toISOString(),
      status: MessageStatus.Delivered,
      rssi: null,
      readAt: null,
      createdAt: yesterdayAt(19, 12, now).toISOString(),
      updatedAt: null,
    },
  ];

  const handshake: Handshake = {
    id: crypto.randomUUID(),
    role: 'scanner',
    localKey: cryptoService.newKey(),
    remoteKey: cryptoService.newKey(),
    peerName: 'Jonas Keller',
    state: 'sent',
    contactId: null,
    createdAt: minutesAgo(10),
    updatedAt: null,
  };

  return {
    contacts: [anna, luca, mia],
    messages,
    handshakes: [handshake],
    settings: {
      install_id: 'demo-install-id',
      display_name: 'HolyG',
      onboarding_done: '1',
      bg_receive: '1',
      vibrate: '0',
    },
  };
}
