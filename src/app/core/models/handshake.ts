/** Fehler beim Hinzufügen eines Kontakts (Pairing per QR-Code). */
export type HandshakeErrorCode =
  | 'invalid-qr'
  | 'antenna-not-ready'
  | 'scan-cancelled'
  | 'scanner-unavailable'
  | 'no-pairing'
  | 'self-pair'
  | 'contact-exists'
  | 'storage-full'
  | 'pairing-failed';
