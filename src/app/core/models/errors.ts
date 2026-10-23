export type { AntennaErrorCode } from './antenna';
export type { HandshakeErrorCode } from './handshake';

export type BackupErrorCode = 'wrong-password' | 'invalid-file' | 'write-failed';

export type LocationErrorCode = 'location-denied' | 'location-timeout' | 'location-unavailable' | 'no-maps-app';

export type FormErrorCode = 'name-invalid' | 'password-too-short' | 'password-mismatch';

export type GroupErrorCode =
  'group-name-invalid' | 'group-no-members' | 'group-too-many' | 'group-too-large' | 'group-duplicate-names';
