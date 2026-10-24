import { Injectable, signal } from '@angular/core';
import { Geolocation, type PermissionStatus, type Position } from '@capacitor/geolocation';

import { log } from '../log';
import type { LocationErrorCode } from '../models/errors';
import type { GeoFix } from '../models/message';
import { isNative } from '../platform';

/** Der Demo-Fix im Browser: Luzern. */
const DEMO_LATITUDE = 47.05021;
const DEMO_LONGITUDE = 8.30934;
const DEMO_ACCURACY = 8;

/** So lange wartet die App im Browser auf den Demo-Fix. */
const DEMO_DELAY_MS = 600;

/** Höchstens so lange dauert eine Ortung. */
const LOCATE_TIMEOUT_MS = 20_000;

/** Ein Fix gilt 10 Minuten lang als frisch. */
const FRESH_MS = 10 * 60_000;

/** Die Berechtigung wurde nicht erteilt. */
const DENIED = Symbol('location-denied');

/** Die Ortung hat zu lange gedauert. */
const TIMEOUT = Symbol('location-timeout');

/**
 * Im Browser und mit dem Mock-Gerät gibt es keinen echten GPS-Fix: dort steht der Demo-Fix.
 *
 * (`localStorage og.mock = '1'` schaltet laut `offgrid-architecture` §3 auch auf Android das Mock-Gerät ein.)
 */
function useDemoFix(): boolean {
  if (!isNative()) {
    return true;
  }
  return typeof localStorage !== 'undefined' && localStorage.getItem('og.mock') === '1';
}

/** Erlaubt ist der genaue oder der ungefähre Standort. */
function isGranted(status: PermissionStatus): boolean {
  return status.location === 'granted' || status.coarseLocation === 'granted';
}

/**
 * Der eigene Standort.
 *
 * `locate()` braucht die Berechtigung und stellt den GPS-Fix bereit. Im Browser gibt es keinen
 * echten GPS, dort kommt nach 600 ms ein Demo-Fix aus Luzern, damit die Vorführung reproduzierbar ist.
 * Fehler stehen in `error`; die Oberfläche zeigt sie an.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly myFixSignal = signal<GeoFix | null>(null);
  private readonly locatingSignal = signal(false);
  private readonly errorSignal = signal<LocationErrorCode | null>(null);

  /** Der eigene Standort, falls schon bestimmt. */
  readonly myFix = this.myFixSignal.asReadonly();

  /** `true`, solange `locate()` läuft. */
  readonly locating = this.locatingSignal.asReadonly();

  /** Der Fehler der letzten Ortung. */
  readonly error = this.errorSignal.asReadonly();

  /**
   * Bestimmt den eigenen Standort.
   *
   * @returns der Fix oder `null`, wenn die Berechtigung fehlt oder der GPS nicht antwortet.
   */
  async locate(): Promise<GeoFix | null> {
    this.locatingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const fix = useDemoFix() ? await this.demoFix() : await this.gpsFix();
      this.myFixSignal.set(fix);
      return fix;
    } catch (error) {
      if (error === DENIED) {
        this.errorSignal.set('location-denied');
      } else if (error === TIMEOUT) {
        this.errorSignal.set('location-timeout');
      } else {
        log.warn('Standort nicht bestimmbar', error);
        this.errorSignal.set('location-unavailable');
      }
      return null;
    } finally {
      this.locatingSignal.set(false);
    }
  }

  /** Ist der Fix höchstens 10 Minuten alt? */
  isFresh(fix: GeoFix, now: Date): boolean {
    return now.getTime() - Date.parse(fix.at) <= FRESH_MS;
  }

  /** Der Demo-Fix für den Browser. */
  private async demoFix(): Promise<GeoFix> {
    await new Promise<void>((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
    return {
      latitude: DEMO_LATITUDE,
      longitude: DEMO_LONGITUDE,
      accuracy: DEMO_ACCURACY,
      at: new Date().toISOString(),
    };
  }

  /** Der echte Fix: Berechtigung holen, dann den GPS fragen. */
  private async gpsFix(): Promise<GeoFix> {
    if (!(await this.hasPermission())) {
      throw DENIED;
    }
    const position = await this.currentPosition();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Math.round(position.coords.accuracy),
      at: new Date(position.timestamp).toISOString(),
    };
  }

  /** Prüft die Berechtigung und fragt sie an, wenn sie fehlt. */
  private async hasPermission(): Promise<boolean> {
    const status = await Geolocation.checkPermissions();
    if (isGranted(status)) {
      return true;
    }
    const requested = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    return isGranted(requested);
  }

  /** Der GPS-Fix. Eigener Timer, damit der GPS nicht ewig hängt. */
  private currentPosition(): Promise<Position> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(TIMEOUT), LOCATE_TIMEOUT_MS);
    });
    const position = Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: LOCATE_TIMEOUT_MS,
      maximumAge: 30_000,
    });
    return Promise.race([position, timeout]).finally(() => clearTimeout(timer));
  }
}
