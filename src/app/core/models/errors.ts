// Fehlercodes der App. Die Seiten zeigen zu jedem Code den deutschen Text aus dem jeweiligen Skill.

export type AntennaErrorCode =
  'no-device' | 'permission-denied' | 'open-failed' | 'no-info' | 'proto-mismatch' | 'lost';

export type HandshakeErrorCode = 'invalid-qr' | 'antenna-not-ready' | 'scan-cancelled' | 'scanner-unavailable';

export type BackupErrorCode = 'wrong-password' | 'invalid-file' | 'write-failed';

export type LocationErrorCode = 'location-denied' | 'location-timeout' | 'location-unavailable' | 'no-maps-app';

export type FormErrorCode = 'name-invalid' | 'password-too-short' | 'password-mismatch';
