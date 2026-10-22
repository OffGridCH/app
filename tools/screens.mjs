// OffGrid – Screenshots aller Screens für die Doku (Browser + Mock-Antenne + Demo-Daten).
// Aufruf: npm run docs:screens   →   Bilder in doku/assets/screens/<name>.png
// Nicht vorhandene Screens (Ticket noch nicht gebaut) werden übersprungen, das Skript endet trotzdem mit Exit 0.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4300;
const BASE = `http://localhost:${PORT}`;
const OUT = 'doku/assets/screens';

const openChat = async (page) => {
  await page.goto(`${BASE}/kontakte`);
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: /Anna Meier/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
};

const SCREENS = [
  { name: 'verbinden', path: '/verbinden' },
  { name: 'kontakte', path: '/kontakte' },
  { name: 'kontakt-hinzufuegen', path: '/kontakte/neu' },
  { name: 'chat', run: openChat },
  {
    name: 'chat-getrennt',
    run: async (page) => {
      await openChat(page);
      await page.evaluate(() => window.ogMock?.drop());
    },
  },
  {
    name: 'standort-senden',
    run: async (page) => {
      await openChat(page);
      await page.getByRole('button', { name: 'Standort senden' }).click({ timeout: 5000 });
      await page.getByText('An Anna Meier senden').waitFor({ timeout: 5000 });
    },
  },
  {
    name: 'standort-ansehen',
    run: async (page) => {
      await openChat(page);
      await page.evaluate(() => window.ogMock?.receiveLocation?.('Anna Meier'));
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Anzeigen' }).last().click({ timeout: 5000 });
      await page.waitForTimeout(1200);
    },
  },
  { name: 'einstellungen', path: '/einstellungen', fullPage: true },
  { name: 'export', path: '/einstellungen/export' },
  { name: 'import', path: '/einstellungen/import' },
];

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev-Server unter ${url} nicht erreichbar`);
}

const server = spawn('npx', ['ng', 'serve', '--port', String(PORT)], { stdio: 'ignore', detached: true });
let failed = 0;
try {
  await mkdir(OUT, { recursive: true });
  await waitForServer(BASE, 180000);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  });
  for (const screen of SCREENS) {
    const page = await context.newPage();
    try {
      if (screen.path) {
        await page.goto(`${BASE}${screen.path}`);
        await page.waitForTimeout(2000);
      }
      if (screen.run) await screen.run(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${screen.name}.png`, fullPage: Boolean(screen.fullPage) });
      console.log(`ok: ${screen.name}`);
    } catch (err) {
      failed++;
      console.log(`übersprungen: ${screen.name} (${err.message.split('\n')[0]})`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
} finally {
  try {
    process.kill(-server.pid);
  } catch {
    /* Server schon beendet */
  }
}
console.log(`Fertig. ${SCREENS.length - failed} Screenshots, ${failed} übersprungen.`);
