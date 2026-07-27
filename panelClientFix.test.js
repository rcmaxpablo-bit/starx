const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

class Builder {
  constructor() {
    this.data = {};
  }
  setColor(value) { this.data.color = value; return this; }
  setTitle(value) { this.data.title = value; this.title = value; return this; }
  setDescription(value) { this.data.description = value; this.description = value; return this; }
  setFooter(value) { this.data.footer = value; return this; }
  setCustomId(value) { this.data.custom_id = value; this.customId = value; return this; }
  setPlaceholder(value) { this.data.placeholder = value; return this; }
  addOptions(...value) { this.data.options = value.flat(); return this; }
  addComponents(...value) { this.components = value.flat(); return this; }
}

function loadCustomerPanel() {
  const originalLoad = Module._load;
  const panelCalls = [];

  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'discord.js') {
      return {
        Events: {
          ClientReady: 'ready',
          InteractionCreate: 'interactionCreate',
          MessageCreate: 'messageCreate',
          MessageDelete: 'messageDelete',
          MessageUpdate: 'messageUpdate'
        },
        EmbedBuilder: Builder,
        ActionRowBuilder: Builder,
        StringSelectMenuBuilder: Builder,
        StringSelectMenuOptionBuilder: Builder
      };
    }

    if (request === './dataStore' && parent?.filename?.endsWith('customerPanel.js')) {
      return {
        getCustomer: userId => ({
          userId,
          spent: 25,
          transactions: 2,
          firstPurchaseAt: new Date().toISOString(),
          lastPurchaseAt: new Date().toISOString()
        }),
        read: name => name === 'transactions' ? [] : {},
        write: () => {},
        getInviteCount: () => 0,
        importLegitTransaction: () => ({ created: false }),
        rebuildCustomersFromTransactions: () => {},
        removeLegitTransactionByMessageId: () => ({ removed: false }),
        updateLegitTransactionByMessageId: () => ({ updated: false })
      };
    }

    if (request === './panelManager' && parent?.filename?.endsWith('customerPanel.js')) {
      return {
        upsertPanel: async (channel, payload, options) => {
          panelCalls.push({ channel, payload, options });
          return { id: 'panel-message-1' };
        }
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  const modulePath = require.resolve('../customerPanel');
  delete require.cache[modulePath];
  const setup = require('../customerPanel');
  Module._load = originalLoad;

  return { setup, panelCalls };
}

function makeClient() {
  const client = new EventEmitter();
  client.user = { id: 'bot' };
  client.channels = {
    fetch: async () => ({
      id: '1529242794621665371',
      isTextBased: () => true,
      send: async () => ({ id: 'sent' })
    })
  };
  return client;
}

test('obsługa Panelu Klienta jest pierwszym listenerem', () => {
  const { setup } = loadCustomerPanel();
  const client = makeClient();
  const oldListener = () => {};
  client.on('interactionCreate', oldListener);

  setup(client);

  assert.notEqual(client.listeners('interactionCreate')[0], oldListener);
});

test('menu Panelu Klienta jest natychmiast odraczane i edytowane', async () => {
  const { setup } = loadCustomerPanel();
  const client = makeClient();
  setup(client);

  let deferred = false;
  let edited;
  const interaction = {
    customId: 'starx_customer_panel_final',
    channelId: '1529242794621665371',
    values: ['stats'],
    user: { id: 'user-1' },
    guild: {},
    replied: false,
    deferred: false,
    isChatInputCommand: () => false,
    isStringSelectMenu: () => true,
    deferReply: async options => {
      deferred = options.flags === 64;
      interaction.deferred = true;
    },
    editReply: async payload => {
      edited = payload;
      return payload;
    }
  };

  await client.listeners('interactionCreate')[0](interaction);

  assert.equal(deferred, true);
  assert.ok(edited?.embeds?.length === 1);
});

test('/panelklienta potwierdza interakcję i publikuje panel', async () => {
  const { setup, panelCalls } = loadCustomerPanel();
  const client = makeClient();
  setup(client);

  let deferred = false;
  let edited;
  const interaction = {
    commandName: 'panelklienta',
    user: { id: 'admin-1' },
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    isStringSelectMenu: () => false,
    deferReply: async options => {
      deferred = options.flags === 64;
      interaction.deferred = true;
    },
    editReply: async payload => {
      edited = payload;
      return payload;
    }
  };

  await client.listeners('interactionCreate')[0](interaction);

  assert.equal(deferred, true);
  assert.equal(panelCalls.length, 1);
  assert.match(edited.content, /wysłany lub zaktualizowany/i);
});
