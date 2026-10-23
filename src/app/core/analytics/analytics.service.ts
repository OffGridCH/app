import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';

import { environment } from '../../../environments/environment';
import { log } from '../log';
import { AnalyticsConfig, AnalyticsEvent } from '../models/analytics';
import { isNative } from '../platform';

export const ANALYTICS_CONFIG = new InjectionToken<AnalyticsConfig>('ANALYTICS_CONFIG', {
  providedIn: 'root',
  factory: () => ({ posthogKey: environment.posthogKey, posthogHost: environment.posthogHost }),
});

/** Eigene Zufalls-ID nur für die Statistik; bewusst nicht die `install_id` (die speist das Schlüssel-Muster). */
const ID_KEY = 'og.analytics.id';
const QUEUE_KEY = 'og.analytics.queue';
/** Ohne Netz wartet die App oft lange; älteste Ereignisse fallen weg, damit der Speicher klein bleibt. */
export const MAX_QUEUED = 200;
const FLUSH_DELAY_MS = 2000;

interface QueuedEvent {
  event: string;
  timestamp: string;
  properties: Record<string, string | boolean>;
}

/**
 * Nutzungsstatistik mit PostHog über dessen öffentliche Capture-API (`/batch/`), ohne `posthog-js`:
 * Neue Pakete sind laut Skill `offgrid-architecture` nicht erlaubt, und so gibt es weder Autocapture
 * noch Session-Replay noch nachgeladenen Code, der abgeschaltet werden müsste.
 *
 * Gesendet werden nur die Ereignisse aus `AnalyticsEvent`, ohne Personenprofil und ohne GeoIP.
 * Ohne Projektschlüssel ist alles ein No-op. Ohne Netz bleiben Ereignisse in `localStorage` und
 * gehen raus, sobald das Handy wieder online ist oder die App in den Vordergrund kommt.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ANALYTICS_CONFIG);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enabled = this.config.posthogKey.trim() !== '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  /** Einmal beim Start (App-Initializer): meldet `app_opened` und danach jeden Screen-Wechsel. */
  init(): void {
    if (!this.enabled) {
      return;
    }
    this.track({ name: 'app_opened' });

    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.track({ name: 'screen_viewed', screen: routePattern(this.router.routerState.snapshot.root) });
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    const onOnline = (): void => void this.flush();
    window.addEventListener('online', onOnline);
    this.destroyRef.onDestroy(() => window.removeEventListener('online', onOnline));
    if (isNative()) {
      void App.addListener('resume', () => void this.flush());
    }
  }

  /** Ein Ereignis zählen. Nur die Felder aus `AnalyticsEvent` werden übertragen. */
  track(event: AnalyticsEvent): void {
    if (!this.enabled) {
      return;
    }
    const properties: QueuedEvent['properties'] = {
      $process_person_profile: false,
      $geoip_disable: true,
      $lib: 'offgrid-app',
      platform: isNative() ? 'android' : 'web',
    };
    if (event.name === 'screen_viewed') {
      properties['screen'] = event.screen;
    }
    const queue = this.readQueue();
    queue.push({ event: event.name, timestamp: new Date().toISOString(), properties });
    this.writeQueue(queue.slice(-MAX_QUEUED));
    this.scheduleFlush();
  }

  /** Schickt die Warteschlange; bei Fehlern bleibt sie für den nächsten Versuch liegen. */
  async flush(): Promise<void> {
    if (!this.enabled || this.flushing) {
      return;
    }
    const batch = this.readQueue();
    if (batch.length === 0) {
      return;
    }
    this.flushing = true;
    try {
      const distinctId = this.distinctId();
      const response = await fetch(`${this.config.posthogHost.replace(/\/+$/, '')}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.posthogKey,
          batch: batch.map((e) => ({ ...e, distinct_id: distinctId })),
        }),
      });
      if (response.ok) {
        // Was während des Sendens dazukam, bleibt in der Warteschlange.
        this.writeQueue(this.readQueue().slice(batch.length));
      }
    } catch {
      // Offline oder PostHog nicht erreichbar: später erneut.
    } finally {
      this.flushing = false;
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_DELAY_MS);
  }

  private distinctId(): string {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  }

  private readQueue(): QueuedEvent[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isQueuedEvent) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedEvent[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      log.warn('Analytics-Warteschlange nicht gespeichert', e);
    }
  }
}

/** Routen-Muster statt URL, z. B. `chat/:contactId`: die echte URL enthält Kontakt- und Nachrichten-IDs. */
export function routePattern(root: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  let node: ActivatedRouteSnapshot | null = root;
  while (node) {
    const path = node.routeConfig?.path;
    if (path) {
      parts.push(path);
    }
    node = node.firstChild;
  }
  return parts.join('/') || '/';
}

function isQueuedEvent(value: unknown): value is QueuedEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    typeof value.event === 'string' &&
    'timestamp' in value &&
    typeof value.timestamp === 'string' &&
    'properties' in value &&
    typeof value.properties === 'object' &&
    value.properties !== null
  );
}
