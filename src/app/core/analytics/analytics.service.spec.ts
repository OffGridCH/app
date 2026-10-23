import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';

import { ANALYTICS_CONFIG, AnalyticsService, MAX_QUEUED } from './analytics.service';

@Component({ selector: 'app-empty', template: '' })
class EmptyComponent {}

function setup(posthogKey: string): AnalyticsService {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'chat/:contactId', component: EmptyComponent }]),
      { provide: ANALYTICS_CONFIG, useValue: { posthogKey, posthogHost: 'https://eu.i.posthog.com/' } },
    ],
  });
  return TestBed.inject(AnalyticsService);
}

interface SentBody {
  api_key: string;
  batch: { event: string; distinct_id: string; properties: Record<string, unknown> }[];
}

function sentBodies(fetchMock: ReturnType<typeof vi.fn>): SentBody[] {
  return fetchMock.mock.calls.map((call) => {
    const init: RequestInit = call[1];
    return JSON.parse(String(init.body));
  });
}

describe('AnalyticsService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ohne Schlüssel: kein Netzverkehr und nichts gespeichert', async () => {
    const analytics = setup('');
    analytics.init();
    analytics.track({ name: 'message_sent' });
    await analytics.flush();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('sendet Routen-Muster statt URL und nur erlaubte Eigenschaften', async () => {
    const analytics = setup('phc_test');
    analytics.init();
    await TestBed.inject(Router).navigateByUrl('/chat/3f0c9a52-1111-4222-8333-444455556666');
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://eu.i.posthog.com/batch/');
    const [body] = sentBodies(fetchMock);
    expect(body.api_key).toBe('phc_test');
    expect(body.batch.map((e) => e.event)).toEqual(['app_opened', 'screen_viewed']);

    const screen = body.batch[1];
    expect(screen.properties).toEqual({
      $process_person_profile: false,
      $geoip_disable: true,
      $lib: 'offgrid-app',
      platform: 'web',
      screen: 'chat/:contactId',
    });
    expect(JSON.stringify(body)).not.toContain('3f0c9a52');
    expect(new Set(body.batch.map((e) => e.distinct_id)).size).toBe(1);
    expect(localStorage.getItem('og.analytics.queue')).toBe('[]');
  });

  it('offline: Ereignisse bleiben liegen, begrenzt, und gehen beim nächsten Versuch raus', async () => {
    const analytics = setup('phc_test');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    for (let i = 0; i < MAX_QUEUED + 5; i++) {
      analytics.track({ name: 'message_sent' });
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(JSON.parse(localStorage.getItem('og.analytics.queue') ?? '[]')).toHaveLength(MAX_QUEUED);

    fetchMock.mockResolvedValue({ ok: true });
    await analytics.flush();
    expect(sentBodies(fetchMock).at(-1)?.batch).toHaveLength(MAX_QUEUED);
    expect(localStorage.getItem('og.analytics.queue')).toBe('[]');
  });
});
