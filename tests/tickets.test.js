const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Collection, ComponentType, Events } = require("discord.js");

function createClient() {
  const client = new EventEmitter();
  client.user = { id: "bot" };
  client.channels = { fetch: async () => null };
  return client;
}

test("menu wymiany odpowiada modalem", async () => {
  const client = createClient();
  require("../tickets")(client);

  let modal;
  const interaction = {
    customId: "ticket_select",
    values: ["exchange"],
    user: { id: "123", username: "klient" },
    guild: { channels: { cache: new Collection() } },
    isStringSelectMenu: () => true,
    isRepliable: () => true,
    showModal: async value => { modal = value.toJSON(); }
  };

  await client.listeners(Events.InteractionCreate)[0](interaction);

  assert.equal(modal.custom_id, "exchange_full_modal");
  assert.equal(modal.components.length, 4);
  // Zachowujemy te asercje z gałęzi naprawczej: gwarantują, że modal nie
  // wróci przypadkiem do niekompatybilnych komponentów Label/select menu.
  assert.ok(modal.components.every(row => row.type === ComponentType.ActionRow));
  assert.ok(modal.components.every(row =>
    row.components.length === 1 &&
    row.components[0].type === ComponentType.TextInput
  ));
});

test("błąd menu zawsze otrzymuje odpowiedź zamiast przekroczenia czasu", async () => {
  const client = createClient();
  require("../tickets")(client);

  let response;
  const interaction = {
    customId: "ticket_select",
    values: ["exchange"],
    user: { id: "123", username: "klient" },
    guild: null,
    isStringSelectMenu: () => true,
    isRepliable: () => true,
    reply: async value => { response = value; }
  };

  await client.listeners(Events.InteractionCreate)[0](interaction);

  assert.match(response.content, /Wystąpił błąd/);
  assert.equal(response.ephemeral, true);
});
