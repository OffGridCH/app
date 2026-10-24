import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { vi } from 'vitest';

import { LocationService } from './location.service';

/** Das Geolocation-Plugin als Attrappe. */
const geolocation = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}));

vi.mock('@capacitor/geolocation', () => ({ Geolocation: geolocation }));

/** Eine erlaubte Berechtigung. */
const GRANTED = { location: 'granted', coarseLocation: 'granted' } as const;

/** Eine verweigerte Berechtigung. */
const DENIED_PERMISSION = { location: 'denied', coarseLocation: 'denied' } as const;

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(() => {
    // Auf dem Handy (nativ) sucht der GPS den Fix, im Browser steht der Demo-Fix.
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    geolocation.checkPermissions.mockReset();
    geolocation.requestPermissions.mockReset();
    geolocation.getCurrentPosition.mockReset();
    geolocation.checkPermissions.mockResolvedValue(GRANTED);
    geolocation.requestPermissions.mockResolvedValue(DENIED_PERMISSION);
    service = TestBed.inject(LocationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('locate', () => {
    it('setzt myFix aus dem GPS', async () => {
      const timestamp = Date.parse('2026-10-24T12:00:00.000Z');
      geolocation.getCurrentPosition.mockResolvedValue({
        timestamp,
        coords: { latitude: 47.05021, longitude: 8.30934, accuracy: 8.4 },
      });

      const fix = await service.locate();

      expect(fix).toEqual({
        latitude: 47.05021,
        longitude: 8.30934,
        accuracy: 8,
        at: '2026-10-24T12:00:00.000Z',
      });
      expect(service.myFix()).toEqual(fix);
      expect(service.error()).toBeNull();
      expect(service.locating()).toBe(false);
    });

    it('fragt die Berechtigung an, wenn sie fehlt', async () => {
      geolocation.checkPermissions.mockResolvedValue(DENIED_PERMISSION);
      geolocation.requestPermissions.mockResolvedValue(GRANTED);
      geolocation.getCurrentPosition.mockResolvedValue({
        timestamp: Date.now(),
        coords: { latitude: 47.05, longitude: 8.31, accuracy: 5 },
      });

      const fix = await service.locate();

      expect(geolocation.requestPermissions).toHaveBeenCalledWith({
        permissions: ['location', 'coarseLocation'],
      });
      expect(fix).not.toBeNull();
      expect(service.error()).toBeNull();
    });

    it('meldet location-denied, wenn die Berechtigung verweigert wird', async () => {
      geolocation.checkPermissions.mockResolvedValue(DENIED_PERMISSION);

      const fix = await service.locate();

      expect(fix).toBeNull();
      expect(service.myFix()).toBeNull();
      expect(service.error()).toBe('location-denied');
      expect(service.locating()).toBe(false);
      expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('meldet location-unavailable, wenn der GPS fehlschlägt', async () => {
      geolocation.getCurrentPosition.mockRejectedValue(new Error('kein GPS'));

      const fix = await service.locate();

      expect(fix).toBeNull();
      expect(service.error()).toBe('location-unavailable');
      expect(service.locating()).toBe(false);
    });

    it('meldet location-timeout, wenn der GPS nicht antwortet', async () => {
      vi.useFakeTimers();
      geolocation.getCurrentPosition.mockReturnValue(new Promise(() => undefined));

      const pending = service.locate();
      await vi.advanceTimersByTimeAsync(20_000);

      expect(await pending).toBeNull();
      expect(service.error()).toBe('location-timeout');
      expect(service.locating()).toBe(false);
    });

    it('liefert im Browser nach 600 ms den Demo-Fix', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
      vi.useFakeTimers();

      const pending = service.locate();
      expect(service.locating()).toBe(true);
      await vi.advanceTimersByTimeAsync(600);
      const fix = await pending;

      expect(fix?.latitude).toBe(47.05021);
      expect(fix?.longitude).toBe(8.30934);
      expect(fix?.accuracy).toBe(8);
      expect(service.myFix()).toEqual(fix);
      expect(service.error()).toBeNull();
      expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });
  });

  describe('isFresh', () => {
    const now = new Date('2026-10-24T12:00:00.000Z');
    const fixAt = (iso: string): { latitude: number; longitude: number; accuracy: number; at: string } => ({
      latitude: 47.05,
      longitude: 8.31,
      accuracy: 8,
      at: iso,
    });

    it('gilt bis 10 Minuten nach der Messung als frisch', () => {
      expect(service.isFresh(fixAt('2026-10-24T11:50:00.000Z'), now)).toBe(true);
      expect(service.isFresh(fixAt('2026-10-24T11:59:59.000Z'), now)).toBe(true);
    });

    it('ist nach 10 Minuten nicht mehr frisch', () => {
      expect(service.isFresh(fixAt('2026-10-24T11:49:59.000Z'), now)).toBe(false);
    });
  });
});
