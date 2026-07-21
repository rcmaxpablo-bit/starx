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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [key, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(DEFAULTS[key], null, 2), 'utf8');
    }
  }
}

function read(name) {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(FILES[name], 'utf8'));
  } catch (error) {
    console.error(`DATA READ ERROR (${name}):`, error);
    return clone(DEFAULTS[name]);
  }
}

function write(name, value) {
  ensureDataFiles();
  const tmp = `${FILES[name]}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, FILES[name]);
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

function confirmLatestPendingTransaction(userId) {
  const transactions = read('transactions');
  for (let i = transactions.length - 1; i >= 0; i -= 1) {
    const tx = transactions[i];
    if (tx.userId === userId && tx.status === 'pending_rep') {
      tx.status = 'confirmed';
      tx.confirmedAt = new Date().toISOString();
      write('transactions', transactions);
      return tx;
    }
  }
  return null;
}

function incrementLegitCount() {
  const settings = read('settings');
  settings.legitCount = Number(settings.legitCount || 0) + 1;
  write('settings', settings);
  return settings.legitCount;
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

module.exports = {
  ensureDataFiles,
  read,
  write,
  getCustomer,
  recordTransaction,
  confirmLatestPendingTransaction,
  incrementLegitCount,
  getInviteCount,
  setInviteCount,
  addInviteCount
};
