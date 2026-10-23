import { Injectable, Injector, inject } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

import { AntennaPort } from './antenna/antenna-port';
import { DatabaseService } from './data/database.service';
import { MemoryDatabaseService } from './data/memory/memory-database.service';
import { HandshakeService } from './handshake/handshake.service';
import { log } from './log';
import { MessagingService } from './messaging/messaging.service';
import { STATUS_BAR_COLOR, isNative } from './platform';
import { SettingsService } from './settings/settings.service';

/** Startet die App: Datenbank, Einstellungen, Antenne und (nativ) Statusleiste und Splashscreen. */
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
      this.startAntenna();
      await this.prepareNative();
    } catch (error) {
      log.error('Start der App fehlgeschlagen', error);
    }
  }

  /**
   * Startet die Dienste, die auf die Antenne hören, und verbindet im Hintergrund.
   *
   * `MessagingService` und `HandshakeService` müssen leben, bevor die erste Nachricht kommt; sie werden
   * sonst erst von den Seiten erzeugt. Das Verbinden wird nicht abgewartet: Fehler stehen in `AntennaPort.error`.
   */
  private startAntenna(): void {
    this.injector.get(MessagingService);
    this.injector.get(HandshakeService);
    void this.injector.get(AntennaPort).connect();
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
