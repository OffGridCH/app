import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Testhilfen, um Quelltexte der App zu prüfen.
 *
 * Einige Regeln des Design-Systems lassen sich nur am Quelltext prüfen – z. B. dass eine
 * Komponente den Schriftschnitt aus `src/theme/typography.scss` verwendet und keine
 * eigenen Rohwerte einträgt. Diese Hilfe liest die Datei relativ zur Projektwurzel,
 * damit der Test unabhängig vom Arbeitsverzeichnis des Testlaufs läuft.
 */

let cachedRoot: string | null = null;

/**
 * Sucht die Projektwurzel (das Verzeichnis mit `angular.json`).
 *
 * Fällt sie auf das aktuelle Arbeitsverzeichnis zurück, wenn keine `angular.json`
 * gefunden wird.
 */
export function projectRoot(): string {
  if (cachedRoot !== null) {
    return cachedRoot;
  }

  let directory = process.cwd();
  for (;;) {
    if (existsSync(resolve(directory, 'angular.json'))) {
      cachedRoot = directory;
      return cachedRoot;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      cachedRoot = process.cwd();
      return cachedRoot;
    }
    directory = parent;
  }
}

/**
 * Liest eine Datei der App relativ zur Projektwurzel.
 *
 * @param relativePath Pfad ab Projektwurzel, z. B. `src/theme/typography.scss`.
 * @returns Inhalt der Datei.
 */
export function readProjectSource(relativePath: string): string {
  return readFileSync(resolve(projectRoot(), relativePath), 'utf8');
}
