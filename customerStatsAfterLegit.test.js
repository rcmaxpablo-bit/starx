const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('dataStore udostępnia trwałe ID paneli', () => {
  const store = require('../dataStore');

  assert.equal(typeof store.getPanelMessageId, 'function');
  assert.equal(typeof store.setPanelMessageId, 'function');
  assert.equal(typeof store.deletePanelMessageId, 'function');
});

test('panelManager wysyła panel nawet gdy zapis ID się nie powiedzie', async () => {
  const store = require('../dataStore');
  const originalGet = store.getPanelMessageId;
  const originalSet = store.setPanelMessageId;

  store.getPanelMessageId = () => {
    throw new Error('symulowany błąd odczytu');
  };
  store.setPanelMessageId = () => {
    throw new Error('symulowany błąd zapisu');
  };

  delete require.cache[require.resolve('../panelManager')];
  const { upsertPanel } = require('../panelManager');

  let sent = 0;
  const message = {
    id: 'panel-1',
    author: { id: 'bot' },
    components: [],
    embeds: [],
    createdTimestamp: Date.now(),
    edit: async () => message,
    delete: async () => {}
  };

  const channel = {
    id: 'channel-1',
    client: { user: { id: 'bot' } },
    isTextBased: () => true,
    messages: {
      fetch: async argument => argument && typeof argument === 'string'
        ? null
        : new Map()
    },
    send: async () => {
      sent += 1;
      return message;
    }
  };

  try {
    const result = await upsertPanel(
      channel,
      { content: 'panel' },
      { customId: 'customer-panel' }
    );

    assert.equal(result.id, 'panel-1');
    assert.equal(sent, 1);
  } finally {
    store.getPanelMessageId = originalGet;
    store.setPanelMessageId = originalSet;
    delete require.cache[require.resolve('../panelManager')];
  }
});

test('Panel Klienta używa wspólnego bezpiecznego upsertPanel', () => {
  const source = fs.readFileSync(path.join(root, 'customerPanel.js'), 'utf8');

  assert.match(source, /require\('\.\/panelManager'\)/);
  assert.match(source, /await upsertPanel\(/);
  assert.doesNotMatch(source, /store\.getPanelMessageId\(/);
  assert.doesNotMatch(source, /store\.setPanelMessageId\(/);
});

test('autolc.js nie zawiera śmieci z pliku .gitignore', () => {
  const source = fs.readFileSync(path.join(root, 'autolc.js'), 'utf8');

  assert.doesNotMatch(source, /^\s*\*\.tmp\s*$/m);
  assert.match(source, /module\.exports\s*=\s*client\s*=>/);
});
