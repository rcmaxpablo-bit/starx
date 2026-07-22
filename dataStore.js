const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  customers: path.join(DATA_DIR, 'customers.json'),
  transactions: path.join(DATA_DIR, 'transactions.json'),
  invites: path.join(DATA_DIR, 'invites.json'),
  settings: path.join(DATA_DIR, 'settings.json')
};

const DEFAULTS = {
  customers: {},
  transactions: [],
  invites: {},
  settings: {
    legitCount: 0,
    legitCounterChannelId: '',
    legitCounterChannelPrefix: '✅・legitcheck➜',
    customerPanelChannelId: '1529242794621665371'
  }
};

// Starsze wdrożenia zapisywały pliki JSON obok index.js. Przy pierwszym
// uruchomieniu po aktualizacji przenosimy je do katalogu data zamiast zerować
// statystyki klientów, transakcje lub zaproszenia.
const LEGACY_FILES = {
  transactions: path.join(__dirname, 'transactions.json'),
  invites: path.join(__dirname, 'invites.json'),
  settings: path.join(__dirname, 'settings.json')
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(name, value) {
  if (name === 'transactions') return Array.isArray(value) ? value : [];
  if (name === 'customers' || name === 'invites' || name === 'settings') {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : clone(DEFAULTS[name]);
  }
  return value;
}

function assertStoreName(name) {
  if (!Object.prototype.hasOwnProperty.call(FILES, name)) {
    throw new TypeError(`Unknown data store: ${name}`);
  }
}

function writeFileAtomically(name, value) {
  const tmp = `${FILES[name]}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, FILES[name]);
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [key, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) {
      const legacyFile = LEGACY_FILES[key];
      if (legacyFile && fs.existsSync(legacyFile)) {
        fs.copyFileSync(legacyFile, file);
      } else {
        fs.writeFileSync(file, JSON.stringify(DEFAULTS[key], null, 2), 'utf8');
      }
    }
  }
}

function read(name) {
  assertStoreName(name);
  ensureDataFiles();
  try {
    const parsed = JSON.parse(fs.readFileSync(FILES[name], 'utf8'));
    const normalized = normalize(name, parsed);

    // Napraw od razu starszy plik zapisany w złym formacie, np. `{}` zamiast
    // tablicy transakcji. Następny restart odczyta już prawidłowy JSON.
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeFileAtomically(name, normalized);
    }
    return normalized;
  } catch (error) {
    console.error(`DATA READ ERROR (${name}):`, error);
    return clone(DEFAULTS[name]);
  }
}

function write(name, value) {
  assertStoreName(name);
  ensureDataFiles();
  value = normalize(name, value);
  writeFileAtomically(name, value);
  return value;
}

function getCustomer(userId) {
  const customers = read('customers');
  return customers[userId] || {
    userId,
    spent: 0,
    transactions: 0,
    firstPurchaseAt: null,
    lastPurchaseAt: null
  };
}

function recordTransaction({ userId, amount, type, description, channelId, moderatorId, currency = 'PLN' }) {
  const numericAmount = Number(amount) || 0;
  const transactions = read('transactions');
  const duplicate = transactions.find(tx => tx.channelId === channelId && tx.status === 'pending_rep');
  if (duplicate) return { transaction: duplicate, created: false };

  const now = new Date().toISOString();
  const transaction = {
    userId,
    amount: numericAmount,
    currency,
    type: type || 'transaction',
    description: description || type || 'Transakcja',
    channelId,
    moderatorId,
    createdAt: now,
    status: 'pending_rep',
    confirmedAt: null
  };
  transactions.push(transaction);
  write('transactions', transactions);

  const customers = read('customers');
  const customer = customers[userId] || {
    userId,
    spent: 0,
    transactions: 0,
    firstPurchaseAt: now,
    lastPurchaseAt: now
  };
  customer.spent = Number(customer.spent || 0) + numericAmount;
  customer.transactions = Number(customer.transactions || 0) + 1;
  customer.firstPurchaseAt ||= now;
  customer.lastPurchaseAt = now;
  customers[userId] = customer;
  write('customers', customers);

  return { transaction, created: true, customer };
}

function importLegitTransaction({ messageId, userId, amount, description, channelId, createdAt, source = 'legit_history' }) {
  if (!messageId || !userId) return { created: false, reason: 'missing_data' };

  const transactions = read('transactions');
  const duplicate = transactions.find(tx => tx.messageId === messageId);
  if (duplicate) return { transaction: duplicate, created: false, reason: 'duplicate' };

  const numericAmount = Number(amount) || 0;
  const timestamp = createdAt || new Date().toISOString();
  const transaction = {
    messageId,
    userId,
    amount: numericAmount,
    currency: 'PLN',
    type: 'legit_check',
    description: description || 'Legit check',
    channelId,
    moderatorId: null,
    createdAt: timestamp,
    status: 'confirmed',
    confirmedAt: timestamp,
    source
  };

  transactions.push(transaction);
  write('transactions', transactions);

  const customers = read('customers');
  const customer = customers[userId] || {
    userId,
    spent: 0,
    transactions: 0,
    firstPurchaseAt: timestamp,
    lastPurchaseAt: timestamp
  };
  customer.spent = Number(customer.spent || 0) + numericAmount;
  customer.transactions = Number(customer.transactions || 0) + 1;
  if (!customer.firstPurchaseAt || new Date(timestamp) < new Date(customer.firstPurchaseAt)) {
    customer.firstPurchaseAt = timestamp;
  }
  if (!customer.lastPurchaseAt || new Date(timestamp) > new Date(customer.lastPurchaseAt)) {
    customer.lastPurchaseAt = timestamp;
  }
  customers[userId] = customer;
  write('customers', customers);

  return { transaction, customer, created: true };
}

function confirmLatestPendingTransaction(userId, messageData = {}) {
  const transactions = read('transactions');

  // Każda wiadomość +rep ma własne messageId. Jeżeli była już zapisana,
  // nie wolno naliczać jej drugi raz po restarcie ani ponownej synchronizacji.
  if (messageData.messageId) {
    const alreadyProcessed = transactions.find(tx => tx.messageId === messageData.messageId);
    if (alreadyProcessed) return alreadyProcessed;
  }

  for (let i = transactions.length - 1; i >= 0; i -= 1) {
    const tx = transactions[i];
    if (tx.userId === userId && tx.status === 'pending_rep') {
      const confirmedAt = messageData.createdAt || new Date().toISOString();
      tx.status = 'confirmed';
      tx.confirmedAt = confirmedAt;
      tx.messageId = messageData.messageId || tx.messageId || null;
      tx.legitChannelId = messageData.channelId || tx.legitChannelId || null;
      tx.legitContent = messageData.content || tx.legitContent || null;
      tx.source = messageData.source || tx.source || 'legit_live';
      write('transactions', transactions);
      return tx;
    }
  }
  return null;
}

function rebuildCustomersFromTransactions() {
  const transactions = read('transactions');
  const customers = {};

  for (const tx of transactions) {
    if (!tx?.userId) continue;
    const timestamp = tx.confirmedAt || tx.createdAt || new Date().toISOString();
    const customer = customers[tx.userId] || {
      userId: tx.userId,
      spent: 0,
      transactions: 0,
      firstPurchaseAt: timestamp,
      lastPurchaseAt: timestamp
    };

    customer.spent = Number(customer.spent || 0) + (Number(tx.amount) || 0);
    customer.transactions = Number(customer.transactions || 0) + 1;
    if (!customer.firstPurchaseAt || new Date(timestamp) < new Date(customer.firstPurchaseAt)) {
      customer.firstPurchaseAt = timestamp;
    }
    if (!customer.lastPurchaseAt || new Date(timestamp) > new Date(customer.lastPurchaseAt)) {
      customer.lastPurchaseAt = timestamp;
    }
    customers[tx.userId] = customer;
  }

  write('customers', customers);
  return customers;
}

function removeLegitTransactionByMessageId(messageId) {
  if (!messageId) return { removed: false, reason: 'missing_message_id' };

  const transactions = read('transactions');
  const index = transactions.findIndex(tx => tx.messageId === messageId);
  if (index === -1) return { removed: false, reason: 'not_found' };

  const [transaction] = transactions.splice(index, 1);
  write('transactions', transactions);
  rebuildCustomersFromTransactions();
  return { removed: true, transaction };
}

function updateLegitTransactionByMessageId(messageId, changes = {}) {
  if (!messageId) return { updated: false, reason: 'missing_message_id' };
  const transactions = read('transactions');
  const transaction = transactions.find(tx => tx.messageId === messageId);
  if (!transaction) return { updated: false, reason: 'not_found' };

  if (changes.amount !== undefined) transaction.amount = Number(changes.amount) || 0;
  if (changes.description !== undefined) transaction.description = changes.description || 'Legit check';
  if (changes.content !== undefined) transaction.legitContent = changes.content;
  transaction.updatedAt = new Date().toISOString();

  write('transactions', transactions);
  rebuildCustomersFromTransactions();
  return { updated: true, transaction };
}

function setLegitCount(value) {
  const settings = read('settings');
  settings.legitCount = Math.max(0, Number(value) || 0);
  write('settings', settings);
  return settings.legitCount;
}

function incrementLegitCount() {
  const settings = read('settings');
  return setLegitCount(Number(settings.legitCount || 0) + 1);
}

function getPanelMessageId(panelKey) {
  if (!panelKey) return null;
  return read('settings').panelMessages?.[panelKey] || null;
}

function setPanelMessageId(panelKey, messageId) {
  if (!panelKey || !messageId) return null;
  const settings = read('settings');
  settings.panelMessages ||= {};
  settings.panelMessages[panelKey] = messageId;
  write('settings', settings);
  return messageId;
}

function getInviteCount(guildId, userId) {
  const invites = read('invites');
  return Number(invites?.[guildId]?.[userId] || 0);
}

function setInviteCount(guildId, userId, value) {
  const invites = read('invites');
  invites[guildId] ||= {};
  invites[guildId][userId] = Math.max(0, Number(value) || 0);
  write('invites', invites);
  return invites[guildId][userId];
}

function addInviteCount(guildId, userId, amount = 1) {
  return setInviteCount(guildId, userId, getInviteCount(guildId, userId) + Number(amount || 0));
}

function importInviteLog({ guildId, messageId, inviterId, total = null }) {
  if (!guildId || !messageId || !inviterId) {
    return { imported: false, reason: 'missing_data' };
  }

  const invites = read('invites');
  invites[guildId] ||= {};
  invites._importedMessages ||= {};

  if (invites._importedMessages[messageId]) {
    return { imported: false, reason: 'duplicate', total: getInviteCount(guildId, inviterId) };
  }

  const current = Number(invites[guildId][inviterId] || 0);
  const parsedTotal = total === null || total === undefined ? null : Math.max(0, Number(total) || 0);
  const next = parsedTotal === null ? current + 1 : Math.max(current, parsedTotal);

  invites[guildId][inviterId] = next;
  invites._importedMessages[messageId] = {
    guildId,
    inviterId,
    importedAt: new Date().toISOString()
  };
  write('invites', invites);

  return { imported: true, total: next };
}

module.exports = {
  ensureDataFiles,
  read,
  write,
  getCustomer,
  recordTransaction,
  importLegitTransaction,
  confirmLatestPendingTransaction,
  rebuildCustomersFromTransactions,
  removeLegitTransactionByMessageId,
  updateLegitTransactionByMessageId,
  setLegitCount,
  incrementLegitCount,
  getPanelMessageId,
  setPanelMessageId,
  getInviteCount,
  setInviteCount,
  addInviteCount,
  importInviteLog
};
