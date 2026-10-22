// Prüft die Toolchain, mit der die Tests laufen. Ticket T00 Schritt 0 und `.kilo/rules/00-projekt.md`
// verlangen Node ≥ 24.15 (Angular 22). Der Test schlägt fehl, wenn lokal oder in der CI mit einer
// zu alten Node-Version getestet wird.

describe('Test-Umgebung', () => {
  it('läuft auf Node ≥ 24.15', () => {
    const [major, minor] = process.versions.node.split('.').map(Number);
    expect(major * 100 + minor).toBeGreaterThanOrEqual(2415);
  });
});