// Geschlossene Liste der Nutzungsereignisse. Es gibt bewusst kein freies Eigenschaftsfeld:
// Nachrichtentexte, Namen, Schlüssel, QR-Inhalte, Gerätedaten und Standorte können so gar nicht
// erst in ein Ereignis gelangen. `screen` ist immer das Routen-Muster (z. B. `chat/:contactId`),
// nie die echte URL mit IDs.
export type AnalyticsEvent =
  | { name: 'app_opened' }
  | { name: 'screen_viewed'; screen: string }
  | { name: 'pairing_started' }
  | { name: 'pairing_completed' }
  | { name: 'message_sent' };

export interface AnalyticsConfig {
  /** Öffentlicher PostHog-Projektschlüssel (`phc_…`). Leer = Analytics aus, kein Netzverkehr. */
  posthogKey: string;
  /** PostHog-Host, z. B. `https://eu.i.posthog.com`. */
  posthogHost: string;
}
