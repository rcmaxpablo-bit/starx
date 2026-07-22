/**
 * Finds and updates a permanent Discord panel instead of sending a duplicate
 * after every bot restart. Older matching duplicates are removed safely.
 */
const store = require('./dataStore');

function panelKey(channel, options = {}) {
  const marker = options.customId || options.embedTitle;
  return marker ? `${channel.id}:${marker}` : null;
}

function hasCustomId(message, customId) {
  if (!customId) return false;

  return message.components?.some(row =>
    row.components?.some(component => component.customId === customId)
  ) || false;
}

function hasEmbedTitle(message, embedTitle) {
  if (!embedTitle) return false;
  return message.embeds?.some(embed => embed.title === embedTitle) || false;
}

function matchesPanel(message, clientUserId, options = {}) {
  if (!message || message.author?.id !== clientUserId) return false;

  const checks = [];
  if (options.customId) checks.push(hasCustomId(message, options.customId));
  if (options.embedTitle) checks.push(hasEmbedTitle(message, options.embedTitle));

  return checks.length > 0 && checks.some(Boolean);
}

async function findPanelMessages(channel, options = {}) {
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) return [];

  try {
    const key = panelKey(channel, options);
    const savedId = key ? store.getPanelMessageId(key) : null;
    const [fetched, saved] = await Promise.all([
      channel.messages.fetch({ limit: 100 }),
      savedId ? channel.messages.fetch(savedId).catch(() => null) : null
    ]);
    const clientUserId = channel.client.user?.id;

    if (saved) fetched.set(saved.id, saved);

    return [...fetched.values()]
      .filter(message => matchesPanel(message, clientUserId, options))
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  } catch (error) {
    console.log("⚠️ Nie udało się wyszukać starego panelu:", error.message);
    return [];
  }
}

async function findPanelMessage(channel, options = {}) {
  const messages = await findPanelMessages(channel, options);
  return messages[0] || null;
}

async function upsertPanel(channel, payload, options = {}) {
  const messages = await findPanelMessages(channel, options);
  let panelMessage = messages[0] || null;

  if (panelMessage) {
    try {
      panelMessage = await panelMessage.edit(payload);
    } catch (error) {
      console.log("⚠️ Nie udało się edytować panelu, wysyłam nowy:", error.message);
      panelMessage = await channel.send(payload);
    }
  } else {
    panelMessage = await channel.send(payload);
  }

  const key = panelKey(channel, options);
  if (key) store.setPanelMessageId(key, panelMessage.id);

  // Usuń wyłącznie starsze wiadomości tego samego panelu.
  for (const duplicate of messages.slice(1)) {
    if (duplicate.id === panelMessage.id) continue;
    await duplicate.delete().catch(() => {});
  }

  return panelMessage;
}

module.exports = {
  findPanelMessages,
  findPanelMessage,
  upsertPanel
};
