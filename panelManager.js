/**
 * Wysyła albo edytuje stały panel Discorda bez tworzenia duplikatów.
 *
 * Najpierw próbuje użyć zapisanego ID wiadomości. Jeżeli ID zniknęło
 * (np. po ponownym wdrożeniu bez trwałego dysku), przeszukuje historię
 * kanału i odnajduje panel po customId albo tytule embeda.
 */
const store = require('./dataStore');

function panelKey(channel, options = {}) {
  const marker =
    options.panelKey ||
    options.customId ||
    options.embedTitle ||
    options.embedTitleIncludes;

  return marker && channel?.id
    ? `${channel.id}:${String(marker)}`
    : null;
}

function getSavedPanelId(key) {
  if (!key) return null;

  try {
    if (typeof store.getPanelMessageId === 'function') {
      return store.getPanelMessageId(key);
    }

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

    if (
      typeof store.read === 'function' &&
      typeof store.write === 'function'
    ) {
      const settings = store.read('settings') || {};

      settings.panelMessages =
        settings.panelMessages &&
        typeof settings.panelMessages === 'object' &&
        !Array.isArray(settings.panelMessages)
          ? settings.panelMessages
          : {};

      settings.panelMessages[key] = String(messageId);
      store.write('settings', settings);
    }
  } catch (error) {
    // Panel został już wysłany albo edytowany, więc błąd magazynu nie może
    // zablokować działania bota.
    console.warn('⚠️ PANEL STORE WRITE:', error?.message || error);
  }
}

function deleteSavedPanelId(key) {
  if (!key) return;

  try {
    if (typeof store.deletePanelMessageId === 'function') {
      store.deletePanelMessageId(key);
    }
  } catch (error) {
    console.warn('⚠️ PANEL STORE DELETE:', error?.message || error);
  }
}

function componentCustomId(component) {
  return component?.customId || component?.data?.custom_id || null;
}

function messageCustomIds(message) {
  const ids = [];

  for (const row of message?.components || []) {
    for (const component of row?.components || []) {
      const id = componentCustomId(component);
      if (id) ids.push(String(id));
    }
  }

  return ids;
}

function hasMatchingCustomId(message, options = {}) {
  const ids = messageCustomIds(message);
  if (!ids.length) return false;

  const exactIds = [
    options.customId,
    ...(Array.isArray(options.customIds) ? options.customIds : [])
  ]
    .filter(Boolean)
    .map(String);

  if (exactIds.some(expected => ids.includes(expected))) {
    return true;
  }

  const prefixes = [
    options.customIdPrefix,
    ...(Array.isArray(options.customIdPrefixes)
      ? options.customIdPrefixes
      : [])
  ]
    .filter(Boolean)
    .map(String);

  return prefixes.some(prefix =>
    ids.some(id => id.startsWith(prefix))
  );
}

function hasMatchingEmbed(message, options = {}) {
  const embeds = message?.embeds || [];
  if (!embeds.length) return false;

  if (options.embedTitle) {
    const expected = String(options.embedTitle).trim().toUpperCase();

    if (
      embeds.some(embed =>
        String(embed?.title || '').trim().toUpperCase() === expected
      )
    ) {
      return true;
    }
  }

  const includes = [
    options.embedTitleIncludes,
    ...(Array.isArray(options.embedTitleIncludesAny)
      ? options.embedTitleIncludesAny
      : [])
  ]
    .filter(Boolean)
    .map(value => String(value).trim().toUpperCase());

  return includes.some(fragment =>
    embeds.some(embed =>
      String(embed?.title || '').toUpperCase().includes(fragment)
    )
  );
}

function matchesPanel(message, clientUserId, options = {}) {
  if (!message || message.author?.id !== clientUserId) return false;

  return (
    hasMatchingCustomId(message, options) ||
    hasMatchingEmbed(message, options)
  );
}

async function fetchSavedMessage(channel, savedId) {
  if (!savedId || !channel?.messages?.fetch) return null;

  return channel.messages.fetch(savedId).catch(error => {
    // Unknown Message / brak dostępu oznacza, że zapisane ID jest nieaktualne.
    if (error?.code !== 10008) {
      console.warn(
        `⚠️ Nie udało się pobrać zapisanego panelu ${savedId}:`,
        error?.message || error
      );
    }

    return null;
  });
}

async function scanPanelHistory(channel, options, found) {
  if (!channel?.messages?.fetch) return;

  const maxScan = Math.max(100, Number(options.maxScan || 1000));
  let before;
  let scanned = 0;

  while (scanned < maxScan) {
    const limit = Math.min(100, maxScan - scanned);

    let batch;
    try {
      batch = await channel.messages.fetch({
        limit,
        ...(before ? { before } : {})
      });
    } catch (error) {
      console.warn(
        '⚠️ Nie udało się pobrać historii panelu:',
        error?.message || error
      );
      return;
    }

    if (!batch?.size) return;

    for (const message of batch.values()) {
      found.set(message.id, message);
    }

    scanned += batch.size;
    before = batch.last()?.id;

    if (batch.size < limit || !before) return;
  }
}

async function findPanelMessages(channel, options = {}) {
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) {
    return [];
  }

  const key = panelKey(channel, options);
  const savedId = getSavedPanelId(key);
  const found = new Map();

  // Zapisane ID sprawdzamy jako pierwsze. Dzięki temu zwykła aktualizacja
  // panelu wykonuje tylko jedno zapytanie do Discorda.
  const savedMessage = await fetchSavedMessage(channel, savedId);
  if (savedMessage) {
    found.set(savedMessage.id, savedMessage);
  } else if (savedId) {
    deleteSavedPanelId(key);
  }

  // Po restarcie albo ponownym wdrożeniu plik settings.json może nie zawierać
  // ID. Przeszukujemy więc historię, również starszą niż ostatnie 100 wpisów.
  if (
    options.scanHistory !== false &&
    (!savedMessage || options.findDuplicates !== false)
  ) {
    await scanPanelHistory(channel, options, found);
  }

  const clientUserId = channel.client?.user?.id;

  return [...found.values()]
    .filter(message => matchesPanel(message, clientUserId, options))
    .sort(
      (a, b) =>
        Number(b.createdTimestamp || 0) -
        Number(a.createdTimestamp || 0)
    );
}

async function findPanelMessage(channel, options = {}) {
  const messages = await findPanelMessages(channel, {
    ...options,
    findDuplicates: false
  });

  return messages[0] || null;
}

async function upsertPanel(channel, payload, options = {}) {
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
    throw new TypeError(
      'Nie można wysłać panelu: kanał nie jest tekstowy.'
    );
  }

  const key = panelKey(channel, options);
  const messages = await findPanelMessages(channel, options);
  let panelMessage = messages[0] || null;

  if (panelMessage) {
    try {
      panelMessage = await panelMessage.edit(payload);
      console.log(`✅ Panel zaktualizowany: ${panelMessage.id}`);
    } catch (error) {
      console.warn(
        `⚠️ Nie udało się edytować panelu ${panelMessage.id}, wysyłam nowy:`,
        error?.message || error
      );

      deleteSavedPanelId(key);
      panelMessage = null;
    }
  }

  if (!panelMessage) {
    panelMessage = await channel.send(payload);
    console.log(`✅ Panel wysłany: ${panelMessage.id}`);
  }

  savePanelId(key, panelMessage.id);

  // Usuwamy tylko starsze duplikaty dokładnie tego samego panelu.
  for (const duplicate of messages) {
    if (duplicate.id === panelMessage.id) continue;
    await duplicate.delete().catch(() => {});
  }

  return panelMessage;
}

module.exports = {
  panelKey,
  matchesPanel,
  findPanelMessages,
  findPanelMessage,
  upsertPanel
};
