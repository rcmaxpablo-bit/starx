const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  Collection,
  ComponentType,
  Events
} = require("discord.js");

function createClient() {
  const client = new EventEmitter();

  client.user = { id: "bot" };
  client.channels = {
    fetch: async () => null
  };

  return client;
}

test("menu wymiany otwiera formularz z listami wyboru", async () => {
  const client = createClient();

  require("../tickets")(client);

  let modal;

  const interaction = {
    customId: "ticket_select",
    values: ["exchange"],

    user: {
      id: "123",
      username: "klient"
    },

    guild: {
      channels: {
        cache: new Collection()
      }
    },

    isStringSelectMenu: () => true,
    isRepliable: () => true,

    showModal: async value => {
      modal = value.toJSON();
    }
  };

  const listeners = client.listeners(Events.InteractionCreate);

  assert.ok(
    listeners.length > 0,
    "Moduł tickets nie zarejestrował listenera interactionCreate"
  );

  await listeners[0](interaction);

  assert.ok(modal, "Formularz nie został wyświetlony");
  assert.equal(modal.custom_id, "exchange_full_modal");
  assert.equal(modal.components.length, 4);

  assert.ok(
    modal.components.every(component => component.type === ComponentType.Label),
    "Każde pole formularza powinno znajdować się w komponencie Label"
  );

  const [amount, from, to, currency] = modal.components;

  assert.equal(amount.component.type, ComponentType.TextInput);
  assert.equal(amount.component.custom_id, "exchange_amount");

  for (const [component, customId] of [
    [from, "exchange_from"],
    [to, "exchange_to"],
    [currency, "exchange_currency"]
  ]) {
    assert.equal(component.component.type, ComponentType.StringSelect);
    assert.equal(component.component.custom_id, customId);
    assert.ok(component.component.options.length >= 3);
  }

  const expectedMethods = ["BLIK", "KODBLIK", "PSC", "PAYPAL", "CRYPTO", "SKRILL"];
  assert.deepEqual(from.component.options.map(option => option.value), expectedMethods);
  assert.deepEqual(to.component.options.map(option => option.value), expectedMethods);

  for (const option of [...from.component.options, ...to.component.options]) {
    assert.ok(option.emoji, `Brak emoji dla opcji ${option.value}`);
    assert.ok(
      option.emoji.id || option.emoji.name,
      `Niepoprawne emoji dla opcji ${option.value}`
    );
  }
});

test(
  "błąd menu zawsze otrzymuje odpowiedź zamiast przekroczenia czasu",
  async () => {
    const client = createClient();

    require("../tickets")(client);

    let response;

    const interaction = {
      customId: "ticket_select",
      values: ["exchange"],

      user: {
        id: "123",
        username: "klient"
      },

      guild: null,

      isStringSelectMenu: () => true,
      isRepliable: () => true,

      reply: async value => {
        response = value;
      }
    };

    const listeners = client.listeners(Events.InteractionCreate);

    assert.ok(
      listeners.length > 0,
      "Moduł tickets nie zarejestrował listenera interactionCreate"
    );

    await listeners[0](interaction);

    assert.ok(response, "Interakcja nie otrzymała odpowiedzi");
    assert.match(response.content, /Wystąpił błąd/i);
    assert.equal(response.ephemeral, true);
  }
);

test("ustawienia ticketa używają list wyboru metod", async () => {
  const client = createClient();
  require("../tickets")(client);

  let modal;
  const interaction = {
    customId: "ticket_settings",
    member: { roles: { cache: { has: () => true } } },
    channel: {
      id: "channel-1",
      topic: "123:exchange:50:BLIK:LTC:PLN"
    },
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    isRepliable: () => true,
    showModal: async value => {
      modal = value.toJSON();
    }
  };

  await client.listeners(Events.InteractionCreate)[0](interaction);

  assert.ok(modal, "Formularz ustawień nie został wyświetlony");
  assert.equal(modal.custom_id, "ticket_settings_modal");
  assert.equal(modal.components.length, 3);

  const [amount, from, to] = modal.components;
  assert.equal(amount.component.type, ComponentType.TextInput);
  assert.equal(from.component.type, ComponentType.StringSelect);
  assert.equal(to.component.type, ComponentType.StringSelect);

  const settingsMethods = ["BLIK", "KODBLIK", "PSC", "PAYPAL", "CRYPTO", "LTC", "SKRILL"];
  assert.deepEqual(from.component.options.map(option => option.value), settingsMethods);
  assert.deepEqual(to.component.options.map(option => option.value), settingsMethods);
  assert.equal(to.component.options.find(option => option.value === "LTC").default, true);
});

test("formularz zakupu ma listę wyboru metody płatności", async () => {
  const client = createClient();
  require("../tickets")(client);

  let modal;
  const interaction = {
    customId: "send_legit_check",
    member: { roles: { cache: { has: () => true } } },
    channel: { topic: "123:buy" },
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    isRepliable: () => true,
    showModal: async value => {
      modal = value.toJSON();
    }
  };

  await client.listeners(Events.InteractionCreate)[0](interaction);

  assert.ok(modal, "Formularz zakupu nie został wyświetlony");
  assert.equal(modal.custom_id, "purchase_legit_modal");
  assert.equal(modal.components.length, 3);

  const method = modal.components[2];
  assert.equal(method.component.type, ComponentType.StringSelect);
  assert.equal(method.component.custom_id, "purchase_method");
  assert.deepEqual(
    method.component.options.map(option => option.value),
    ["BLIK", "KODBLIK", "PSC", "PAYPAL", "CRYPTO", "SKRILL"]
  );
});
