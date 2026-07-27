const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("LTC jest dostępne w formularzu ticketów", () => {
  const source = read("tickets.js");
  assert.ok(
    /setLabel\("LTC"\)[\s\S]*?setValue\("LTC"\)/.test(source) ||
    /label:\s*"LTC",\s*value:\s*"LTC"/.test(source)
  );
  assert.match(source, /"BLIK->LTC": 8/);
  assert.match(source, /"KODBLIK->LTC": 11/);
  assert.match(source, /"PAYPAL->LTC": 9/);
  assert.match(source, /"CRYPTO->LTC": 4/);
  assert.match(source, /"LTC->BLIK": 4/);
  assert.match(source, /"LTC->KODBLIK": 4/);
  assert.match(source, /"LTC->PAYPAL": 4/);
  assert.match(source, /"LTC->CRYPTO": 4/);
});

test("LTC jest dostępne w kalkulatorze prowizji", () => {
  const source = read("obliczprowizje.js");
  assert.match(source, /setLabel\("LTC"\)[\s\S]*?setValue\("LTC"\)/);
  assert.match(source, /BLIK_LTC: 8/);
  assert.match(source, /KODBLIK_LTC: 11/);
  assert.match(source, /PAYPAL_LTC: 9/);
  assert.match(source, /CRYPTO_LTC: 4/);
  assert.match(source, /LTC_BLIK: 4/);
  assert.match(source, /LTC_KODBLIK: 4/);
  assert.match(source, /LTC_PAYPAL: 4/);
  assert.match(source, /LTC_CRYPTO: 4/);
});

test("panel z listą prowizji pokazuje LTC", () => {
  const source = read("kalkulator.js");
  assert.match(source, /LTC:\s*\[/);
  assert.match(source, /label: "LTC", value: "LTC"/);
  assert.match(source, /\*\*LTC\*\* -> .*\*\*BLIK\*\* - Prowizja wynosi: \*\*4%\*\*/);
  assert.match(source, /\*\*LTC\*\* -> .*\*\*PAYPAL\*\* - Prowizja wynosi: \*\*4%\*\*/);
  assert.match(source, /\*\*LTC\*\* -> .*\*\*CRYPTO\*\* - Prowizja wynosi: \*\*4%\*\*/);
});
