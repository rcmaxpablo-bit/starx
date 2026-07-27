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

  client.user = {
    id: "bot"
  };

  client.channels = {
    fetch: async () => null
  };

  return client;
}

test("menu wymiany odpowiada wyborem metod", async () => {
  const client = createClient();

  require("../tickets")(client);

  let response = null;

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
    isModalSubmit: () => false,
    isButton: () => false,
    isChatInputCommand: () => false,
    isRepliable: () => true,

    reply: async payload => {
      response = {
        ...payload,
        components: payload.components?.map(component =>
          typeof component.toJSON === "function"
            ? component.toJSON()
            : component
        )
      };
    }
  };

  const listeners = client.listeners(Events.InteractionCreate);

  assert.ok(
    listeners.length > 0,
    "Moduł tickets nie zarejestrował listenera InteractionCreate"
  );

  await listeners[0](interaction);

  assert.ok(
    response,
    "Bot nie odpowiedział na wybór kategorii wymiany"
  );

  assert.match(
    response.content,
    /Wybierz metody wymiany/i
  );

  assert.equal(
    response.ephemeral,
    true,
    "Menu wyboru powinno być widoczne tylko dla użytkownika"
  );

  assert.equal(
    response.components.length,
    3,
    "Powinny zostać wyświetlone trzy menu: z czego, na co i waluta"
  );

  assert.ok(
    response.components.every(
      row => row.type === ComponentType.ActionRow
    ),
    "Każdy komponent powinien być ActionRow"
  );

  assert.ok(
    response.components.every(
      row =>
        row.components?.length === 1 &&
        row.components[0].type === ComponentType.StringSelect
    ),
    "Każdy ActionRow powinien zawierać jedno StringSelectMenu"
  );

  const fromOptions =
    response.components[0].components[0].options;

  const toOptions =
    response.components[1].components[0].options;

  const currencyOptions =
    response.components[2].components[0].options;

  const fromValues = fromOptions.map(option => option.value);
  const toValues = toOptions.map(option => option.value);
  const currencyValues = currencyOptions.map(option => option.value);

  assert.ok(fromValues.includes("BLIK"));
  assert.ok(fromValues.includes("LTC"));
  assert.ok(fromValues.includes("BTC"));
  assert.ok(fromValues.includes("ETH"));
  assert.ok(fromValues.includes("SOL"));
  assert.ok(fromValues.includes("USDT"));

  assert.ok(toValues.includes("BLIK"));
  assert.ok(toValues.includes("LTC"));
  assert.ok(toValues.includes("BTC"));
  assert.ok(toValues.includes("ETH"));
  assert.ok(toValues.includes("SOL"));
  assert.ok(toValues.includes("USDT"));

  assert.deepEqual(
    currencyValues,
    ["PLN", "EUR", "USD"]
  );
});

test("wybranie wszystkich ustawień otwiera modal kwoty", async () => {
  const client = createClient();

  require("../tickets")(client);

  const listeners = client.listeners(Events.InteractionCreate);

  assert.ok(
    listeners.length > 0,
    "Moduł tickets nie zarejestrował listenera InteractionCreate"
  );

  const listener = listeners[0];

  let currentComponents = null;
  let modal = null;

  function createSelectInteraction(customId, value) {
    return {
      customId,
      values: [value],

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
      isModalSubmit: () => false,
      isButton: () => false,
      isChatInputCommand: () => false,
      isRepliable: () => true,

      update: async payload => {
        currentComponents = payload.components;
      },

      showModal: async value => {
        modal =
          typeof value.toJSON === "function"
            ? value.toJSON()
            : value;
      }
    };
  }

  await listener(
    createSelectInteraction(
      "exchange_from_select",
      "BLIK"
    )
  );

  assert.ok(
    currentComponents,
    "Po wyborze pierwszej metody menu powinno zostać zaktualizowane"
  );

  await listener(
    createSelectInteraction(
      "exchange_to_select",
      "LTC"
    )
  );

  await listener(
    createSelectInteraction(
      "exchange_currency_select",
      "PLN"
    )
  );

  assert.ok(
    modal,
    "Po wybraniu metod i waluty modal kwoty nie został wyświetlony"
  );

  assert.equal(
    modal.custom_id,
    "exchange_amount_modal"
  );

  assert.equal(
    modal.components.length,
    1
  );

  assert.equal(
    modal.components[0].type,
    ComponentType.ActionRow
  );

  assert.equal(
    modal.components[0].components.length,
    1
  );

  assert.equal(
    modal.components[0].components[0].type,
    ComponentType.TextInput
  );
});

test(
  "błąd menu zawsze otrzymuje odpowiedź zamiast przekroczenia czasu",
  async () => {
    const client = createClient();

    require("../tickets")(client);

    let response = null;

    const interaction = {
      customId: "ticket_select",
      values: ["exchange"],

      user: {
        id: "123",
        username: "klient"
      },

      guild: null,

      isStringSelectMenu: () => true,
      isModalSubmit: () => false,
      isButton: () => false,
      isChatInputCommand: () => false,
      isRepliable: () => true,

      deferred: false,
      replied: false,

      reply: async payload => {
        response = payload;
      }
    };

    const listeners = client.listeners(
      Events.InteractionCreate
    );

    assert.ok(
      listeners.length > 0,
      "Moduł tickets nie zarejestrował listenera InteractionCreate"
    );

    await listeners[0](interaction);

    assert.ok(
      response,
      "Interakcja nie otrzymała odpowiedzi"
    );

    assert.match(
      response.content,
      /Wystąpił błąd/i
    );

    assert.equal(
      response.ephemeral,
      true
    );
  }
);