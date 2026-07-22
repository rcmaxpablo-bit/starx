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

// Starsze wdrożenia zapisywały pliki JSON obok index.js.
// Przy pierwszym uruchomieniu przenosimy je do katalogu data.
const LEGACY_FILES = {
  customers: path.join(__dirname, 'customers.json'),
  transactions: path.join(__dirname, 'transactions.json'),
  invites: path.join(__dirname, 'invites.json'),
  settings: path.join(__dirname, 'settings.json')
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(name, value) {
  if (name === 'transactions') {
    return Array.isArray(value) ? value : [];
  }

  if (name === 'settings') {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? {
          ...clone(DEFAULTS.settings),
          ...value
        }
      : clone(DEFAULTS.settings);
  }

  if (name === 'customers' || name === 'invites') {
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
  const tempFile = `${FILES[name]}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(value, null, 2),
    'utf8'
  );

  fs.renameSync(tempFile, FILES[name]);
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const [key, file] of Object.entries(FILES)) {
    if (fs.existsSync(file)) {
      continue;
    }

    const legacyFile = LEGACY_FILES[key];

    if (legacyFile && fs.existsSync(legacyFile)) {
      fs.copyFileSync(legacyFile, file);
    } else {
      fs.writeFileSync(
        file,
        JSON.stringify(DEFAULTS[key], null, 2),
        'utf8'
      );
    }
  }
}

function read(name) {
  assertStoreName(name);
  ensureDataFiles();

  try {
    const fileContent = fs.readFileSync(FILES[name], 'utf8');
    const parsed = JSON.parse(fileContent);
    const normalized = normalize(name, parsed);

    // Naprawiamy automatycznie pliki zapisane w złym formacie,
    // np. transactions.json zawierający {} zamiast [].
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

  const normalized = normalize(name, value);

  writeFileAtomically(name, normalized);

  return normalized;
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

function recordTransaction({
  userId,
  amount,
  type,
  description,
  channelId,
  moderatorId,
  currency = 'PLN'
}) {
  const numericAmount = Number(amount) || 0;
  const transactions = read('transactions');

  const duplicate = transactions.find(
    transaction =>
      transaction.channelId === channelId &&
      transaction.status === 'pending_rep'
  );

  if (duplicate) {
    return {
      transaction: duplicate,
      created: false
    };
  }

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

  customer.spent =
    Number(customer.spent || 0) + numericAmount;

  customer.transactions =
    Number(customer.transactions || 0) + 1;

  customer.firstPurchaseAt ||= now;
  customer.lastPurchaseAt = now;

  customers[userId] = customer;

  write('customers', customers);

  return {
    transaction,
    created: true,
    customer
  };
}

function importLegitTransaction({
  messageId,
  userId,
  amount,
  description,
  channelId,
  createdAt,
  source = 'legit_history'
}) {
  if (!messageId || !userId) {
    return {
      created: false,
      reason: 'missing_data'
    };
  }

  const transactions = read('transactions');

  const duplicate = transactions.find(
    transaction => transaction.messageId === messageId
  );

  if (duplicate) {
    return {
      transaction: duplicate,
      created: false,
      reason: 'duplicate'
    };
  }

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

  customer.spent =
    Number(customer.spent || 0) + numericAmount;

  customer.transactions =
    Number(customer.transactions || 0) + 1;

  if (
    !customer.firstPurchaseAt ||
    new Date(timestamp) < new Date(customer.firstPurchaseAt)
  ) {
    customer.firstPurchaseAt = timestamp;
  }

  if (
    !customer.lastPurchaseAt ||
    new Date(timestamp) > new Date(customer.lastPurchaseAt)
  ) {
    customer.lastPurchaseAt = timestamp;
  }

  customers[userId] = customer;

  write('customers', customers);

  return {
    transaction,
    customer,
    created: true
  };
}

function confirmLatestPendingTransaction(
  userId,
  messageData = {}
) {
  const transactions = read('transactions');

  // Każda wiadomość +rep ma własne messageId.
  // Jeśli wiadomość została już zapisana, nie naliczamy jej drugi raz.
  if (messageData.messageId) {
    const alreadyProcessed = transactions.find(
      transaction =>
        transaction.messageId === messageData.messageId
    );

    if (alreadyProcessed) {
      return alreadyProcessed;
    }
  }

  for (
    let index = transactions.length - 1;
    index >= 0;
    index -= 1
  ) {
    const transaction = transactions[index];

    if (
      transaction.userId === userId &&
      transaction.status === 'pending_rep'
    ) {
      const confirmedAt =
        messageData.createdAt || new Date().toISOString();

      transaction.status = 'confirmed';
      transaction.confirmedAt = confirmedAt;

      transaction.messageId =
        messageData.messageId ||
        transaction.messageId ||
        null;

      transaction.legitChannelId =
        messageData.channelId ||
        transaction.legitChannelId ||
        null;

      transaction.legitContent =
        messageData.content ||
        transaction.legitContent ||
        null;

      transaction.source =
        messageData.source ||
        transaction.source ||
        'legit_live';

      write('transactions', transactions);

      return transaction;
    }
  }

  return null;
}

function rebuildCustomersFromTransactions() {
  const transactions = read('transactions');
  const customers = {};

  for (const transaction of transactions) {
    if (!transaction?.userId) {
      continue;
    }

    const timestamp =
      transaction.confirmedAt ||
      transaction.createdAt ||
      new Date().toISOString();

    const customer = customers[transaction.userId] || {
      userId: transaction.userId,
      spent: 0,
      transactions: 0,
      firstPurchaseAt: timestamp,
      lastPurchaseAt: timestamp
    };

    customer.spent =
      Number(customer.spent || 0) +
      (Number(transaction.amount) || 0);

    customer.transactions =
      Number(customer.transactions || 0) + 1;

    if (
      !customer.firstPurchaseAt ||
      new Date(timestamp) <
        new Date(customer.firstPurchaseAt)
    ) {
      customer.firstPurchaseAt = timestamp;
    }

    if (
      !customer.lastPurchaseAt ||
      new Date(timestamp) >
        new Date(customer.lastPurchaseAt)
    ) {
      customer.lastPurchaseAt = timestamp;
    }

    customers[transaction.userId] = customer;
  }

  write('customers', customers);

  return customers;
}

function removeLegitTransactionByMessageId(messageId) {
  if (!messageId) {
    return {
      removed: false,
      reason: 'missing_message_id'
    };
  }

  const transactions = read('transactions');

  const transactionIndex = transactions.findIndex(
    transaction => transaction.messageId === messageId
  );

  if (transactionIndex === -1) {
    return {
      removed: false,
      reason: 'not_found'
    };
  }

  const [transaction] = transactions.splice(
    transactionIndex,
    1
  );

  write('transactions', transactions);
  rebuildCustomersFromTransactions();

  return {
    removed: true,
    transaction
  };
}

function updateLegitTransactionByMessageId(
  messageId,
  changes = {}
) {
  if (!messageId) {
    return {
      updated: false,
      reason: 'missing_message_id'
    };
  }

  const transactions = read('transactions');

  const transaction = transactions.find(
    item => item.messageId === messageId
  );

  if (!transaction) {
    return {
      updated: false,
      reason: 'not_found'
    };
  }

  if (changes.amount !== undefined) {
    transaction.amount = Number(changes.amount) || 0;
  }

  if (changes.description !== undefined) {
    transaction.description =
      changes.description || 'Legit check';
  }

  if (changes.content !== undefined) {
    transaction.legitContent = changes.content;
  }

  transaction.updatedAt = new Date().toISOString();

  write('transactions', transactions);
  rebuildCustomersFromTransactions();

  return {
    updated: true,
    transaction
  };
}

function setLegitCount(value) {
  const settings = read('settings');

  settings.legitCount = Math.max(
    0,
    Number(value) || 0
  );

  write('settings', settings);

  return settings.legitCount;
}

function incrementLegitCount() {
  const settings = read('settings');

  return setLegitCount(
    Number(settings.legitCount || 0) + 1
  );
}

function getPanelMessageId(panelKey) {
  if (!panelKey) {
    return null;
  }

  const settings = read('settings');

  return settings.panelMessages?.[panelKey] || null;
}

function setPanelMessageId(panelKey, messageId) {
  if (!panelKey || !messageId) {
    return null;
  }

  const settings = read('settings');

  settings.panelMessages ||= {};
  settings.panelMessages[panelKey] = messageId;

  write('settings', settings);

  return messageId;
}

function getInviteCount(guildId, userId) {
  const invites = read('invites');

  return Number(
    invites?.[guildId]?.[userId] || 0
  );
}

function setInviteCount(guildId, userId, value) {
  const invites = read('invites');

  invites[guildId] ||= {};

  invites[guildId][userId] = Math.max(
    0,
    Number(value) || 0
  );

  write('invites', invites);

  return invites[guildId][userId];
}

function addInviteCount(
  guildId,
  userId,
  amount = 1
) {
  const currentInviteCount =
    getInviteCount(guildId, userId);

  return setInviteCount(
    guildId,
    userId,
    currentInviteCount + Number(amount || 0)
  );
}

function importInviteLog({
  guildId,
  messageId,
  inviterId,
  total = null
}) {
  if (!guildId || !messageId || !inviterId) {
    return {
      imported: false,
      reason: 'missing_data'
    };
  }

  const invites = read('invites');

  invites[guildId] ||= {};
  invites._importedMessages ||= {};

  if (invites._importedMessages[messageId]) {
    return {
      imported: false,
      reason: 'duplicate',
      total: getInviteCount(guildId, inviterId)
    };
  }

  const current =
    Number(invites[guildId][inviterId] || 0);

  const parsedTotal =
    total === null || total === undefined
      ? null
      : Math.max(0, Number(total) || 0);

  const next =
    parsedTotal === null
      ? current + 1
      : Math.max(current, parsedTotal);

  invites[guildId][inviterId] = next;

  invites._importedMessages[messageId] = {
    guildId,
    inviterId,
    importedAt: new Date().toISOString()
  };

  write('invites', invites);

  return {
    imported: true,
    total: next
  };
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