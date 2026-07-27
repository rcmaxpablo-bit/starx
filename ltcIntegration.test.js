const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("formularz wymiany ma domyślnie zaznaczone PLN", () => {
  const source = read("tickets.js");
  assert.ok(source.includes('.addOptions(currencyOptions("PLN"))'));
});

test("przyciski ticketa używają niestandardowych emoji StarX", () => {
  const source = read("tickets.js");
  assert.ok(source.includes('componentEmoji(isClaimed ? EMOJI.unlock : EMOJI.ticket'));
  assert.ok(source.includes('componentEmoji(EMOJI.setting'));
  assert.ok(source.includes('componentEmoji(EMOJI.lock'));
  assert.ok(source.includes('componentEmoji(EMOJI.zap'));
});

test("kliknięcie Legit Check nie zapisuje statystyk ani nie nadaje roli", () => {
  const source = read("tickets.js");
  assert.ok(!source.includes("saveCustomerTransaction("));
  assert.ok(!source.includes("giveClientRoleById("));
  assert.ok(!source.includes("pendingLegitTickets"));
});

test("panel klienta pokazuje tylko potwierdzone transakcje", () => {
  const panel = read("customerPanel.js");
  const store = read("dataStore.js");
  assert.ok(panel.includes("t.status === 'confirmed'"));
  assert.ok(store.includes("transaction.status !== 'confirmed'"));
});

test("rola Klient jest nadawana po faktycznym +rep", () => {
  const source = read("lc.js");
  assert.ok(source.includes('member.roles.add(CLIENT_ROLE_ID'));
  assert.ok(source.includes('Klient wystawił legit check +rep'));
});
