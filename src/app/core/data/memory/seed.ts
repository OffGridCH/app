import type { Contact } from '../../models/contact';
import { MessageStatus, type Message } from '../../models/message';

/** Demo-Daten für den Browser (Demo-Verlauf laut `offgrid-screens` §6). */
export interface DemoData {
  contacts: Contact[];
  messages: Message[];
  settings: Record<string, string>;
}

/**
 * Die Demo-Kontakte, so wie das simulierte Gerät sie kennt (`MockDevice`).
 *
 * Die App und der Mock müssen dieselben Kontakte haben, sonst ersetzt die Synchronisation sie beim Verbinden.
 * Schlüssel und Fingerabdrücke sind erfunden und nur für die Demo.
 */
export const DEMO_CONTACTS: readonly Contact[] = [
  {
    contactId: 1,
    name: 'Anna Meier',
    nodeId: 'ECE4',
    publicKey: 'A5d2V7F/elA8qTcKyHqIP0WiIe7IjNTvZ30L+2bBRls=',
    state: 'active',
    fingerprint: '4821 0937 1156',
    lastRssi: -92,
    lastSnr: 7.5,
    txCtr: 3,
    rxHighestCtr: 2,
  },
  {
    contactId: 2,
    name: 'Luca Bernasconi',
    nodeId: 'ADC2',
    publicKey: 'BqrLZITC2oY61ClcpwPFdCqy4fG2okPDHpdGQrTK4qI=',
    state: 'active',
    fingerprint: '7304 6218 0095',
    lastRssi: -100,
    lastSnr: 4.0,
    txCtr: 0,
    rxHighestCtr: 1,
  },
  {
    contactId: 3,
    name: 'Mia Frei',
    nodeId: '8E2D',
    publicKey: 'DuQAXvPB/3K5X3OnKS0xWmT92GDGn7rAaK40rByhzV0=',
    state: 'active',
    fingerprint: '1659 8842 3370',
    lastRssi: -110,
    lastSnr: 1.5,
    txCtr: 2,
    rxHighestCtr: null,
  },
  {
    contactId: 4,
    name: 'Jonas Keller',
    nodeId: '8DDB',
    publicKey: 'g7QWg+3lRb2fJHHIWz2mlAyShdhQDQyb6uG8Aw//aeo=',
    state: 'pending',
    fingerprint: '9027 5513 6841',
    lastRssi: null,
    lastSnr: null,
    txCtr: 0,
    rxHighestCtr: null,
  },
];

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
 * Erzeugt die Demo-Daten: vier Kontakte (einer davon noch ausstehend) mit Verlauf.
 * Das Gerät kennt dieselben Kontakte (`DEMO_CONTACTS`).
 */
export function createDemoData(now: Date = new Date()): DemoData {
  const minutesAgo = (minutes: number): string => new Date(now.getTime() - minutes * 60_000).toISOString();

  const contacts = DEMO_CONTACTS.map((contact) => ({ ...contact }));
  const [anna, luca, mia] = contacts;

  const message = (
    contactId: number,
    ctr: number,
    direction: Message['direction'],
    content: string,
    sentAt: string,
    status: MessageStatus,
    readAt: string | null,
    rssi: number | null,
  ): Message => ({
    id: crypto.randomUUID(),
    contactId,
    ctr,
    msgRef: null,
    content,
    direction,
    kind: 'text',
    sentAt,
    status,
    rssi,
    readAt,
    createdAt: sentAt,
    updatedAt: null,
  });

  const annaRead = minutesAgo(12);
  const yesterdayEvening = yesterdayAt(19, 12, now).toISOString();
  const messages: Message[] = [
    message(anna.contactId, 1, 'in', 'Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.', annaRead, MessageStatus.Delivered, annaRead, -92),
    message(anna.contactId, 1, 'out', 'Wir sind bei der Hütte und kommen in etwa 20 Minuten.', minutesAgo(11), MessageStatus.Delivered, null, null),
    message(anna.contactId, 2, 'out', 'Wartest du dort auf uns?', minutesAgo(9), MessageStatus.Sent, null, null),
    message(anna.contactId, 2, 'in', 'Ja, ich warte hier. Es ist ziemlich windig.', minutesAgo(2), MessageStatus.Delivered, null, -92),
    message(luca.contactId, 1, 'in', 'Basislager erreicht.', minutesAgo(180), MessageStatus.Delivered, minutesAgo(180), -100),
    message(mia.contactId, 1, 'out', 'Wir starten morgen um 7 Uhr.', yesterdayEvening, MessageStatus.Delivered, null, null),
  ];

  return {
    contacts,
    messages,
    settings: {
      install_id: 'demo-install-id',
      display_name: 'HolyG',
      onboarding_done: '1',
      bg_receive: '1',
      vibrate: '0',
    },
  };
}
