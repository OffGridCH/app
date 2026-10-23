import { Injectable, Injector, inject } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

import { DatabaseService } from './data/database.service';
import { MemoryDatabaseService } from './data/memory/memory-database.service';
import { log } from './log';
import { STATUS_BAR_COLOR, isNative } from './platform';
import { SettingsService } from './settings/settings.service';

/** Startet die App: Datenbank, Einstellungen und (nativ) Statusleiste und Splashscreen. */
@Injectable({ providedIn: 'root' })
export class AppStartService {
  private readonly injector = inject(Injector);
  private readonly database = inject(DatabaseService);
  private readonly settings = inject(SettingsService);

  async init(): Promise<void> {
    try {
      await this.database.open();
      await this.seedDemoData();
      await this.settings.load();
      await this.prepareNative();
    } catch (error) {
      log.error('Start der App fehlgeschlagen', error);
    }
  }

  /** Im Browser mit Demo-Daten starten (ausser `localStorage og.noseed = '1'`). */
  private async seedDemoData(): Promise<void> {
    if (isNative() || localStorage.getItem('og.noseed') === '1') {
      return;
    }
    await this.injector.get(MemoryDatabaseService).seedDemo();
  }

  /** Statusleiste und Splashscreen einrichten (nur nativ). */
  private async prepareNative(): Promise<void> {
    if (!isNative()) {
      return;
    }
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR });
    await SplashScreen.hide();
  }
}
