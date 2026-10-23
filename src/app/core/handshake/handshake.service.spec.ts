import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { setupAntennaHarness, provisionedDevice, type AntennaHarness } from '../antenna/antenna-harness.testing';
import { toBase64 } from '../crypto/base64';
import { ContactRepository } from '../data/contact.repository';
import { DataChangedService } from '../data/data-changed.service';
import { MessageRepository } from '../data/message.repository';
import { MessageStatus } from '../models/message';
import { HandshakeService, looksLikeOffgridQr } from './handshake.service';

/** Der QR-Text von Bob aus Offgrid Host Interface v1, §11.3. */
const BOB_QR = 'T0cxwLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0gISIjJCUmJygpKissLS4vQm9i';
const BOB_PUBLIC = 'wLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0=';

describe('looksLikeOffgridQr', () => {
  it('erkennt den QR-Text aus der Spezifikation', () => {
    expect(looksLikeOffgridQr(BOB_QR)).toBe(true);
    expect(looksLikeOffgridQr(`  ${BOB_QR}\n`)).toBe(true);
  });

  it('erkennt auch einen Code ohne Namen (51 Bytes)', () => {
    const bytes = new Uint8Array(51);
    bytes.set(new TextEncoder().encode('OG1'));

    expect(looksLikeOffgridQr(toBase64(bytes))).toBe(true);
  });

  it('lehnt Text ohne Base64, mit falscher Kennung oder zu kurz ab', () => {
    expect(looksLikeOffgridQr('')).toBe(false);
    expect(looksLikeOffgridQr('Hallo Welt!')).toBe(false);
    expect(looksLikeOffgridQr('https://example.org/x')).toBe(false);
    expect(looksLikeOffgridQr(toBase64(new TextEncoder().encode('OG1abc')))).toBe(false);
    const wrongMagic = new Uint8Array(51);
    wrongMagic.set(new TextEncoder().encode('XX1'));
    expect(looksLikeOffgridQr(toBase64(wrongMagic))).toBe(false);
  });
});

describe('HandshakeService', () => {
  let harness: AntennaHarness;
  let handshake: HandshakeService;
  let contacts: ContactRepository;
  let messages: MessageRepository;
  let dataChanged: DataChangedService;

  async function connected(options = provisionedDevice()): Promise<void> {
    harness = setupAntennaHarness(options);
    handshake = TestBed.inject(HandshakeService);
    contacts = TestBed.inject(ContactRepository);
    messages = TestBed.inject(MessageRepository);
    dataChanged = TestBed.inject(DataChangedService);
    await harness.antenna.connect();
  }

  afterEach(async () => {
    await harness?.antenna.disconnect();
  });

  describe('Kontakte spiegeln', () => {
    it('holt alle Kontakte des Geräts mit contact.list und speichert sie ohne Schlüssel', async () => {
      await connected();

      await handshake.syncContacts();

      expect(await contacts.all()).toEqual([
        expect.objectContaining({ contactId: 1, name: 'Anna', nodeId: 'ECE4', state: 'active', fingerprint: '4821 0937 1156' }),
        expect.objectContaining({ contactId: 2, name: 'Luca', nodeId: 'ADC2', state: 'pending' }),
      ]);
    });

    it('holt mehr als eine Seite, wenn das Gerät mehr Kontakte hat', async () => {
      const many = Array.from({ length: 23 }, (_, index) => ({
        contact_id: index + 1,
        name: `Kontakt ${index + 1}`,
        node_id: 'ABCD',
        public_key: toBase64(new Uint8Array(32).fill(index + 1)),
        state: 'active' as const,
        fingerprint: '0000 0000 0000',
        tx_ctr: 0,
        rx_highest_ctr: null,
        last_rssi: null,
        last_snr: null,
      }));
      await connected({ ...provisionedDevice(), contacts: many });

      await handshake.syncContacts();

      expect(await contacts.count()).toBe(23);
      expect((await contacts.byId(23))?.name).toBe('Kontakt 23');
    });

    it('gleicht wiederholt ab, ohne den Verlauf zu verlieren', async () => {
      await connected();
      await handshake.syncContacts();
      await messages.insert({
        id: 'm1',
        contactId: 1,
        ctr: 1,
        msgRef: null,
        content: 'Hallo',
        direction: 'in',
        kind: 'text',
        sentAt: new Date().toISOString(),
        status: MessageStatus.Delivered,
        rssi: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });

      await handshake.syncContacts();

      expect(await contacts.count()).toBe(2);
      expect(await messages.forContact(1)).toHaveLength(1);
    });

    it('löscht den Verlauf eines Platzes, der auf dem Gerät einen anderen Schlüssel hat', async () => {
      await connected();
      await contacts.upsert({
        contactId: 1,
        name: 'Alter Kontakt',
        nodeId: 'FFFF',
        publicKey: toBase64(new Uint8Array(32).fill(9)),
        state: 'active',
        fingerprint: '1111 1111 1111',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });
      await messages.insert({
        id: 'alt',
        contactId: 1,
        ctr: 1,
        msgRef: null,
        content: 'Von früher',
        direction: 'in',
        kind: 'text',
        sentAt: new Date().toISOString(),
        status: MessageStatus.Delivered,
        rssi: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });

      await handshake.syncContacts();

      expect((await contacts.byId(1))?.name).toBe('Anna');
      expect(await messages.forContact(1)).toEqual([]);
    });

    it('meldet DataChangedService nach dem Abgleich', async () => {
      await connected();
      const before = dataChanged.version();

      await handshake.syncContacts();

      expect(dataChanged.version()).toBeGreaterThan(before);
    });

    it('tut nichts, solange das Gerät nicht entsperrt ist', async () => {
      harness = setupAntennaHarness(provisionedDevice());
      handshake = TestBed.inject(HandshakeService);
      contacts = TestBed.inject(ContactRepository);

      await handshake.syncContacts();

      expect(await contacts.count()).toBe(0);
    });

    it('holt einen einzelnen Kontakt mit contact.get und meldet null für einen leeren Platz', async () => {
      await connected();

      expect((await handshake.refreshContact(1))?.name).toBe('Anna');
      expect(await contacts.byId(1)).not.toBeNull();
      expect(await handshake.refreshContact(9)).toBeNull();
    });

    it('übernimmt contact.state: ein ausstehender Kontakt wird aktiv', async () => {
      await connected();
      await handshake.syncContacts();
      expect((await contacts.byId(2))?.state).toBe('pending');

      harness.device.injectText(2, 'Hallo');

      await vi.waitFor(async () => expect((await contacts.byId(2))?.state).toBe('active'));
    });
  });

  describe('Mein Code (pair.begin)', () => {
    it('liefert den QR-Text und merkt sich Ablauf', async () => {
      await connected();
      const before = Date.now();

      const qr = await handshake.begin();

      expect(qr).not.toBeNull();
      expect(looksLikeOffgridQr(qr ?? '')).toBe(true);
      expect(handshake.qrText()).toBe(qr);
      expect(handshake.qrExpiresAt()).toBeGreaterThanOrEqual(before + 299_000);
      expect(handshake.error()).toBeNull();
    });

    it('enthält Public Key, Salz und Namen des Geräts', async () => {
      await connected();

      const qr = (await handshake.begin()) ?? '';

      const bytes = Uint8Array.from(atob(qr), (char) => char.charCodeAt(0));
      expect(new TextDecoder().decode(bytes.slice(0, 3))).toBe('OG1');
      expect(bytes.length).toBe(3 + 32 + 16 + 'Test'.length);
      expect(new TextDecoder().decode(bytes.slice(51))).toBe('Test');
    });

    it('meldet antenna-not-ready ohne entsperrtes Gerät', async () => {
      harness = setupAntennaHarness(provisionedDevice());
      handshake = TestBed.inject(HandshakeService);

      expect(await handshake.begin()).toBeNull();
      expect(handshake.error()).toBe('antenna-not-ready');
    });

    it('verwirft das Pairing mit cancel()', async () => {
      await connected();
      await handshake.begin();

      await handshake.cancel();

      expect(handshake.qrText()).toBeNull();
      expect(handshake.qrExpiresAt()).toBeNull();
      await handshake.complete(BOB_QR);
      expect(handshake.error()).toBe('no-pairing');
    });
  });

  describe('Code scannen (pair.complete)', () => {
    it('legt den Kontakt mit Fingerabdruck an und speichert ihn lokal', async () => {
      await connected();
      await handshake.syncContacts();
      await handshake.begin();

      const contact = await handshake.complete(BOB_QR);

      expect(contact).toMatchObject({
        contactId: 3,
        name: 'Bob',
        nodeId: 'E841',
        publicKey: BOB_PUBLIC,
        state: 'pending',
        txCtr: 0,
        rxHighestCtr: null,
      });
      expect(contact?.fingerprint).toMatch(/^\d{4} \d{4} \d{4}$/);
      expect(await contacts.byId(3)).toEqual(contact);
      expect(handshake.completedContactId()).toBe(3);
      expect(handshake.qrText()).toBeNull();
      expect(handshake.error()).toBeNull();
    });

    it('macht den Kontakt aktiv, sobald das Gerät contact.state meldet', async () => {
      await connected();
      await handshake.begin();
      await handshake.complete(BOB_QR);

      await vi.waitFor(async () => expect((await contacts.byId(3))?.state).toBe('active'));
    });

    it('übernimmt einen eigenen Namen', async () => {
      await connected();
      await handshake.begin();

      const contact = await handshake.complete(BOB_QR, { name: 'Robert' });

      expect(contact?.name).toBe('Robert');
    });

    it('setzt completedContactId zurück mit clearCompleted() und bei begin()', async () => {
      await connected();
      await handshake.begin();
      await handshake.complete(BOB_QR);

      handshake.clearCompleted();
      expect(handshake.completedContactId()).toBeNull();

      await handshake.begin();
      await handshake.complete(BOB_QR, { replace: true });
      expect(handshake.completedContactId()).toBe(3);
      await handshake.begin();
      expect(handshake.completedContactId()).toBeNull();
    });

    it('meldet invalid-qr für Text, der kein OffGrid-Code ist, ohne das Gerät zu fragen', async () => {
      await connected();
      await handshake.begin();
      const request = vi.spyOn(harness.antenna, 'request');

      expect(await handshake.complete('https://example.org')).toBeNull();

      expect(handshake.error()).toBe('invalid-qr');
      expect(request).not.toHaveBeenCalled();
    });

    it('meldet no-pairing ohne vorheriges pair.begin', async () => {
      await connected();

      expect(await handshake.complete(BOB_QR)).toBeNull();

      expect(handshake.error()).toBe('no-pairing');
    });

    it('meldet self-pair beim eigenen Code', async () => {
      await connected();
      const own = (await handshake.begin()) ?? '';

      expect(await handshake.complete(own)).toBeNull();

      expect(handshake.error()).toBe('self-pair');
    });

    it('meldet contact-exists beim zweiten Mal und ersetzt mit replace', async () => {
      await connected();
      await handshake.begin();
      await handshake.complete(BOB_QR);
      await handshake.begin();

      expect(await handshake.complete(BOB_QR)).toBeNull();
      expect(handshake.error()).toBe('contact-exists');

      expect(await handshake.complete(BOB_QR, { replace: true })).toMatchObject({ contactId: 3 });
      expect(handshake.error()).toBeNull();
    });

    it('meldet storage-full bei 32 Kontakten', async () => {
      const many = Array.from({ length: 32 }, (_, index) => ({
        contact_id: index + 1,
        name: `K${index + 1}`,
        node_id: 'ABCD',
        public_key: toBase64(new Uint8Array(32).fill(index + 1)),
        state: 'active' as const,
        fingerprint: '0000 0000 0000',
        tx_ctr: 0,
        rx_highest_ctr: null,
        last_rssi: null,
        last_snr: null,
      }));
      await connected({ ...provisionedDevice(), contacts: many });
      await handshake.begin();

      expect(await handshake.complete(BOB_QR)).toBeNull();

      expect(handshake.error()).toBe('storage-full');
    });

    it('meldet antenna-not-ready ohne entsperrtes Gerät', async () => {
      harness = setupAntennaHarness(provisionedDevice());
      handshake = TestBed.inject(HandshakeService);

      expect(await handshake.complete(BOB_QR)).toBeNull();
      expect(handshake.error()).toBe('antenna-not-ready');
    });
  });

  describe('Umbenennen und Löschen', () => {
    it('benennt auf dem Gerät und lokal um', async () => {
      await connected();
      await handshake.syncContacts();

      expect(await handshake.rename(1, '  Anna M.  ')).toBe(true);

      expect((await contacts.byId(1))?.name).toBe('Anna M.');
      expect((await harness.antenna.request('contact.get', { contact_id: 1 }))['contact']).toMatchObject({ name: 'Anna M.' });
    });

    it('lehnt einen zu langen oder leeren Namen ab (1–24 Bytes)', async () => {
      await connected();
      await handshake.syncContacts();

      expect(await handshake.rename(1, 'a'.repeat(25))).toBe(false);
      expect(await handshake.rename(1, '   ')).toBe(false);
      expect(await handshake.rename(1, 'ä'.repeat(12))).toBe(true);
      expect((await contacts.byId(1))?.name).toBe('ä'.repeat(12));
    });

    it('meldet false für einen unbekannten Kontakt', async () => {
      await connected();

      expect(await handshake.rename(9, 'Niemand')).toBe(false);
    });

    it('löscht einen Kontakt auf dem Gerät und lokal samt Verlauf', async () => {
      await connected();
      await handshake.syncContacts();
      await messages.insert({
        id: 'm1',
        contactId: 1,
        ctr: 1,
        msgRef: null,
        content: 'Hallo',
        direction: 'in',
        kind: 'text',
        sentAt: new Date().toISOString(),
        status: MessageStatus.Delivered,
        rssi: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });

      expect(await handshake.remove(1)).toBe(true);

      expect(await contacts.byId(1)).toBeNull();
      expect(await messages.count()).toBe(0);
      await expect(harness.antenna.request('contact.get', { contact_id: 1 })).rejects.toMatchObject({
        code: 'E_NO_SUCH_CONTACT',
      });
    });

    it('räumt lokal auf, wenn der Kontakt auf dem Gerät schon weg ist', async () => {
      await connected();
      await handshake.syncContacts();
      await harness.antenna.request('contact.delete', { contact_id: 1, confirm: true });

      expect(await handshake.remove(1)).toBe(true);

      expect(await contacts.byId(1)).toBeNull();
    });

    it('lässt den Kontakt stehen, wenn das Gerät nicht erreichbar ist', async () => {
      await connected();
      await handshake.syncContacts();
      await harness.antenna.disconnect();

      expect(await handshake.remove(1)).toBe(false);

      expect(await contacts.byId(1)).not.toBeNull();
    });
  });
});
