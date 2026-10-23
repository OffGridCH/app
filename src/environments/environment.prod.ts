export const environment = {
  production: true,
  // Nutzungsstatistik (PostHog EU). Der Projektschlüssel `phc_…` ist öffentlich und für Apps gedacht.
  // Leer = Analytics aus: die App stellt dann keine einzige Anfrage an PostHog.
  posthogKey: '',
  posthogHost: 'https://eu.i.posthog.com',
};
