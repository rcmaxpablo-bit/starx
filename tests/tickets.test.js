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

  let reply;
  const interaction = {
    customId: "ticket_select",
    values: ["exchange"],
    user: { id: "123", username: "klient" },
    guild: { channels: { cache: new Collection() } },
    isStringSelectMenu: () => true,
    isRepliable: () => true,
    reply: async value => { reply = { ...value, components: value.components.map(component => component.toJSON()) }; }
  };

  await client.listeners(Events.InteractionCreate)[0](interaction);

  assert.match(reply.content, /Wybierz metody/);
  assert.equal(reply.components.length, 3);
  assert.ok(reply.components.every(row => row.type === ComponentType.ActionRow));
  assert.ok(reply.components.every(row => row.components[0].type === ComponentType.StringSelect));
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
