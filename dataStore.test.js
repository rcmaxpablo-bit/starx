const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ticketsPath = path.join(__dirname, "..", "tickets.js");
const source = fs.readFileSync(ticketsPath, "utf8");

test("otwarty ticket ma cztery opisane przyciski", () => {
  for (const customId of [
    "claim_ticket",
    "ticket_settings",
    "close_ticket",
    "send_legit_check"
  ]) {
    assert.ok(source.includes(`"${customId}"`), `Brakuje customId: ${customId}`);
  }

  for (const label of [
    "Przejmij Ticket",
    "Ustawienia Ticketa",
    "Zamknij / Wykonane",
    "Legit Check"
  ]) {
    assert.ok(source.includes(label), `Brakuje etykiety: ${label}`);
  }
});

test("ustawienia ticketa używają list wyboru zamiast pól tekstowych dla metod", () => {
  assert.ok(source.includes('.setCustomId("settings_from")'));
  assert.ok(source.includes('.setCustomId("settings_to")'));
  assert.ok(source.includes('.setCustomId("settings_currency")'));
  assert.ok(source.includes('.setStringSelectMenuComponent(fromSelect)'));
  assert.ok(source.includes('.setStringSelectMenuComponent(toSelect)'));
  assert.ok(source.includes('.setStringSelectMenuComponent(currencySelect)'));
});

test("formularz legit check zakupu ma wybór metody płatności", () => {
  assert.ok(source.includes('.setCustomId("purchase_method")'));
  assert.ok(source.includes('.setStringSelectMenuComponent(methodSelect)'));
  assert.ok(!source.includes('.setCustomId("purchase_method")\n            .setLabel'));
});

test("zamknięcie ticketa wymaga potwierdzenia", () => {
  assert.ok(source.includes('setCustomId("confirm_close_ticket")'));
  assert.ok(source.includes('setCustomId("cancel_close_ticket")'));
});

test("LTC jest dostępne we wszystkich listach metod", () => {
  assert.ok(source.includes('{ label: "LTC", value: "LTC"'));
  assert.ok(source.includes('"BLIK->LTC": 8'));
  assert.ok(source.includes('"LTC->BLIK": 4'));
});
