const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const sourceFile = path.join(__dirname, '..', 'dataStore.js');

function loadIsolatedStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starx-store-'));
  fs.copyFileSync(sourceFile, path.join(directory, 'dataStore.js'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, store: require(path.join(directory, 'dataStore.js')) };
}

test('dataStore.js nie zawiera pozostałości konfliktu Git ani drugiej kopii modułu', () => {
  const source = fs.readFileSync(sourceFile, 'utf8');
  assert.doesNotMatch(source, /^(?:<<<<<<<|=======|>>>>>>>)/m);
  assert.equal((source.match(/const fs = require\('fs'\);/g) || []).length, 1);
  assert.equal((source.match(/module\.exports = \{/g) || []).length, 1);
});

test('normalizuje i trwale naprawia starszy format transakcji', t => {
  const { directory, store } = loadIsolatedStore(t);
  fs.writeFileSync(path.join(directory, 'transactions.json'), '{}', 'utf8');

  assert.deepEqual(store.read('transactions'), []);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(directory, 'data', 'transactions.json'), 'utf8')),
    []
  );
});

test('zapisuje transakcję tylko raz dla tego samego +rep', t => {
  const { store } = loadIsolatedStore(t);
  const input = { messageId: 'rep-1', userId: 'user-1', amount: 20 };

  assert.equal(store.importLegitTransaction(input).created, true);
  assert.equal(store.importLegitTransaction(input).created, false);
  assert.equal(store.read('transactions').length, 1);
});
