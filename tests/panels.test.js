const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

class Builder {
  constructor() { this.data = {}; }
  setColor(value) { this.data.color = value; return this; }
  setTitle(value) { this.data.title = value; return this; }
  setDescription(value) { this.data.description = value; return this; }
  setImage(value) { this.data.image = value; return this; }
  setFooter(value) { this.data.footer = value; return this; }
  setCustomId(value) { this.data.custom_id = value; return this; }
  setPlaceholder(value) { this.data.placeholder = value; return this; }
  addOptions(...values) { this.data.options = values.flat(); return this; }
  addComponents(...values) { this.components = values.flat(); return this; }
}

function loadPriceList() {
  const originalLoad = Module._load;
  const panelCalls = [];
  Module._load = function mock(request, parent, isMain) {
    if (request === 'discord.js') return {
      EmbedBuilder: Builder,
      ActionRowBuilder: Builder,
      StringSelectMenuBuilder: Builder,
      Events: { ClientReady: 'ready', InteractionCreate: 'interactionCreate' },
      MessageFlags: { Ephemeral: 64 }
    };
    if (request === './panelManager' && parent?.filename.endsWith('cennik.js')) return {
      upsertPanel: async (...args) => { panelCalls.push(args); }
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  const modulePath = require.resolve('../cennik');
  delete require.cache[modulePath];
  const setup = require('../cennik');
  Module._load = originalLoad;
  return { setup, panelCalls };
}

test('index ładuje właściwy Panel Klienta, a nie tekstowy plik zastępczy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(source, /["']\.\/customerPanel["']/);
  assert.doesNotMatch(source, /["']\.\/customerLegitSystem["']/);
});

test('cennik publikuje panel i odpowiada na wybór kategorii', async () => {
  const { setup, panelCalls } = loadPriceList();
  const client = new EventEmitter();
  client.channels = { fetch: async () => ({ isTextBased: () => true, send: async () => {} }) };
  setup(client);
  client.emit('ready');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(panelCalls.length, 1);
  assert.equal(panelCalls[0][2].customId, 'starx_cennik');

  let deferred = false;
  let response;
  const interaction = {
    customId: 'starx_cennik', values: ['streaming'], deferred: false, replied: false,
    isStringSelectMenu: () => true,
    deferReply: async ({ flags }) => { deferred = flags === 64; interaction.deferred = true; },
    editReply: async payload => { response = payload; }
  };
  await client.listeners('interactionCreate')[0](interaction);
  assert.equal(deferred, true);
  assert.match(response.embeds[0].data.title, /STREAMING/);
  assert.match(response.embeds[0].data.description, /Netflix Lifetime/);
});
