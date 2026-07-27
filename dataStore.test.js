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
