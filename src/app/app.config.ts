import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { AnalyticsService } from './core/analytics/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withComponentInputBinding()),
    // Nutzungsstatistik; ohne PostHog-Schlüssel in environment.prod.ts ein No-op.
    provideAppInitializer(() => inject(AnalyticsService).init()),
  ],
};
