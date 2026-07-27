/**
 * Wysyła albo edytuje stały panel Discorda bez tworzenia duplikatów.
 * Zapamiętane ID wiadomości jest tylko pomocą — błąd magazynu danych nigdy
 * nie może zablokować wysłania panelu.
 */
const store = require('./dataStore');

function panelKey(channel, options = {}) {
  const marker = options.customId || options.embedTitle;
  return marker && channel?.id ? `${channel.id}:${marker}` : null;
}

function getSavedPanelId(key) {
  if (!key) return null;

  try {
    if (typeof store.getPanelMessageId === 'function') {
      return store.getPanelMessageId(key);
    }

    // Zgodność awaryjna ze starszym dataStore.js.
    if (typeof store.read === 'function') {
      return store.read('settings')?.panelMessages?.[key] || null;
    }
  } catch (error) {
    console.warn('⚠️ PANEL STORE READ:', error?.message || error);
  }

  return null;
}

function savePanelId(key, messageId) {
  if (!key || !messageId) return;

  try {
    if (typeof store.setPanelMessageId === 'function') {
      store.setPanelMessageId(key, messageId);
      return;
    }

    // Zgodność awaryjna ze starszym dataStore.js.
    if (typeof store.read === 'function' && typeof store.write === 'function') {
      const settings = store.read('settings') || {};
      settings.panelMessages =
        settings.panelMessages && typeof settings.panelMessages === 'object' && !Array.isArray(settings.panelMessages)
          ? settings.panelMessages
          : {};
      settings.panelMessages[key] = String(messageId);
      store.write('settings', settings);
    }
  } catch (error) {
    // Panel został już wysłany/edytowany, więc błąd zapisu ID nie może go wyłączyć.
    console.warn('⚠️ PANEL STORE WRITE:', error?.message || error);
  }
}

function hasCustomId(message, customId) {
  if (!customId) return false;

  return Boolean(message.components?.some(row =>
    row.components?.some(component =>
      (component.customId || component.data?.custom_id) === customId
    )
  ));
}

function hasEmbedTitle(message, embedTitle) {
  if (!embedTitle) return false;

  const expected = String(embedTitle).trim().toUpperCase();

  return Boolean(message.embeds?.some(embed =>
    String(embed.title || '').trim().toUpperCase() === expected
  ));
}

function matchesPanel(message, clientUserId, options = {}) {
  if (!message || message.author?.id !== clientUserId) return false;

  return (
    (options.customId && hasCustomId(message, options.customId)) ||
    (options.embedTitle && hasEmbedTitle(message, options.embedTitle)) ||
    false
  );
}

async function findPanelMessages(channel, options = {}) {
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) return [];

  const key = panelKey(channel, options);
  const savedId = getSavedPanelId(key);
  const found = new Map();

  try {
    const recent = await channel.messages.fetch({ limit: 100 });
    for (const message of recent.values()) found.set(message.id, message);
  } catch (error) {
    console.warn('⚠️ Nie udało się pobrać historii panelu:', error?.message || error);
  }

  if (savedId && !found.has(savedId)) {
    const saved = await channel.messages.fetch(savedId).catch(() => null);
    if (saved) found.set(saved.id, saved);
  }

  const clientUserId = channel.client?.user?.id;

  return [...found.values()]
    .filter(message => matchesPanel(message, clientUserId, options))
    .sort((a, b) => Number(b.createdTimestamp || 0) - Number(a.createdTimestamp || 0));
}

async function findPanelMessage(channel, options = {}) {
  const messages = await findPanelMessages(channel, options);
  return messages[0] || null;
}

async function upsertPanel(channel, payload, options = {}) {
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    throw new TypeError('Nie można wysłać panelu: kanał nie jest tekstowy.');
  }

  const messages = await findPanelMessages(channel, options);
  let panelMessage = messages[0] || null;

  if (panelMessage) {
    try {
      panelMessage = await panelMessage.edit(payload);
    } catch (error) {
      console.warn('⚠️ Nie udało się edytować panelu, wysyłam nowy:', error?.message || error);
      panelMessage = null;
    }
  }

  if (!panelMessage) {
    panelMessage = await channel.send(payload);
  }

  savePanelId(panelKey(channel, options), panelMessage.id);

  // Usuwamy tylko starsze duplikaty dokładnie tego samego panelu.
  for (const duplicate of messages) {
    if (duplicate.id === panelMessage.id) continue;
    await duplicate.delete().catch(() => {});
  }

  return panelMessage;
}

module.exports = {
  panelKey,
  findPanelMessages,
  findPanelMessage,
  upsertPanel
};
