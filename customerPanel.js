const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const store = require('./dataStore');

const CUSTOMER_PANEL_CHANNEL_ID = '1529242794621665371';
const LEGIT_CHANNEL_ID = '1500893110048133253';
const CUSTOMER_MENU_ID = 'starx_customer_panel_final';
const LEGIT_PREFIX = '│✅・legit-check→';
const BLUE = 0x1b2dff;

const EMOJI = {
  support: '<:WSPARCIE:1500243961124618381>',
  money: '<a:m_:1501685438103031920>',
  list: '<:LIST:1501693215328440370>',
  people: '<:LUDZIE:1500243884733894716>',
  admin: '<:ADM:1501989271077388500>',
  arrow: '<a:Arrow_White:1508094625984811038>',
  cart: '<:SKLEP:1500243849535033577>',
  clock: '<:CZAS:1502030015943151868>',
  pin: '<:PIN:1501697389050986546>',
  warning: '<:PILNE:1501693444030992395>',
  nitro: '<a:nitro:1501684762601848963>'
};

function isRep(content) {
  return /^\+rep(?:\s|$)/i.test(String(content || '').trim());
}

function amountFrom(content) {
  const matches = [...String(content || '').matchAll(/(\d+(?:[.,]\d{1,2})?)\s*pln\b/gi)];
  return matches.length ? Number(matches.at(-1)[1].replace(',', '.')) || 0 : 0;
}

function descriptionFrom(content) {
  const text = String(content || '')
    .replace(/^\+rep\s*/i, '')
    .replace(/<@!?\d+>/g, '')
    .replace(/\b(?:purchased|exchanged|bought|zakupiono|kupiono)\b/i, '')
    .replace(/(\d+(?:[.,]\d{1,2})?)\s*pln\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || 'Zakup z legit checka';
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} PLN`;
}

function date(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? `<t:${Math.floor(ms / 1000)}:d>` : 'Brak';
}

function customerPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(BLUE)
    .setTitle('🌟 StarX Exchange » PANEL KLIENTA')
    .setDescription([
      `${EMOJI.support} **Wybierz odpowiednią opcję z menu poniżej.**`,
      '',
      `${EMOJI.money} Statystyki wydatków i transakcji`,
      `${EMOJI.list} Historia ostatnich zakupów`,
      `${EMOJI.people} Twoje zaproszenia`,
      `${EMOJI.admin} Ranking Top 5 klientów`
    ].join('\n'))
    .setFooter({ text: '© 2026 StarX Exchange » Panel Klienta' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOMER_MENU_ID)
    .setPlaceholder('❌ | Nie wybrano żadnej opcji.')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Moje Statystyki').setDescription('Ile wydałeś i ile masz transakcji.').setValue('stats').setEmoji({ id: '1501685438103031920', animated: true }),
      new StringSelectMenuOptionBuilder().setLabel('Historia Zakupów').setDescription('Twoje ostatnie 5 zakupów.').setValue('history').setEmoji({ id: '1501693215328440370' }),
      new StringSelectMenuOptionBuilder().setLabel('Sprawdź Zaproszenia').setDescription('Ile masz zaproszeń.').setValue('invites').setEmoji({ id: '1500243884733894716' }),
      new StringSelectMenuOptionBuilder().setLabel('Top 5 Klientów').setDescription('Ranking najwięcej wydających.').setValue('top5').setEmoji({ id: '1501989271077388500' })
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function legitPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BLUE)
    .setTitle('🌟 StarX Exchange × LEGIT CHECK')
    .setDescription([
      `${EMOJI.nitro} Dziękujemy za wybranie **StarX Exchange!**`,
      '',
      `${EMOJI.list} Twój legit check jest dla nas bardzo ważny i pomaga budować zaufanie.`,
      '',
      `${EMOJI.arrow} **WZÓR LEGIT CHECKA**`,
      '```md',
      '+rep @seller Purchased [co] [kwota]PLN [metoda]',
      '```',
      '',
      `${EMOJI.arrow} **PRZYKŁAD**`,
      '```md',
      '+rep @jarek.svx Purchased Konto Stake 40PLN [BLIK]',
      '```',
      '',
      `${EMOJI.pin} Po wystawieniu legit checka ticket zostanie automatycznie zamknięty.`
    ].join('\n'))
    .setFooter({ text: '© 2026 StarX Exchange • STARX_LC_PANEL_FINAL' });
}

function isCustomerPanelMessage(message, clientId) {
  return message.author?.id === clientId && message.embeds?.some(e => String(e.title || '').toUpperCase().includes('PANEL KLIENTA'));
}

function isLegitPanelMessage(message, clientId) {
  return message.author?.id === clientId && message.embeds?.some(e => String(e.title || '').includes('LEGIT CHECK') && String(e.description || '').includes('WZÓR LEGIT CHECKA'));
}

async function resolveCustomerId(message) {
  if (!message.webhookId && !message.author?.bot) return message.author.id;
  const raw = String(message.author?.username || '').replace(/\s*\[.*$/i, '').trim().toLowerCase();
  if (!raw || !message.guild) return null;
  await message.guild.members.fetch().catch(() => null);
  const member = message.guild.members.cache.find(m => [m.user.username, m.user.globalName, m.displayName].filter(Boolean).some(n => String(n).toLowerCase() === raw));
  return member?.id || null;
}

module.exports = (client) => {
  const repIds = new Set();
  let renameTimer = null;
  let pendingCount = 0;
  let panelQueue = Promise.resolve();

  async function getTextChannel(id) {
    const channel = await client.channels.fetch(id, { force: true });
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') throw new Error(`Kanał ${id} nie jest tekstowy lub bot go nie widzi.`);
    return channel;
  }

  let customerPanelPromise = null;

  async function publishCustomerPanel(reason = 'system') {
    if (customerPanelPromise) return customerPanelPromise;

    customerPanelPromise = (async () => {
      const channel = await client.channels.fetch(CUSTOMER_PANEL_CHANNEL_ID, { force: true });
      if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') {
        throw new Error(`Kanał ${CUSTOMER_PANEL_CHANNEL_ID} nie jest dostępnym kanałem tekstowym.`);
      }

      // Odczyt starych wiadomości jest opcjonalny. Brak historii nie może blokować
      // wysłania nowego panelu przez /panelklienta.
      let panels = [];
      try {
        const recent = await channel.messages.fetch({ limit: 100 });
        panels = [...recent.values()].filter(m => isCustomerPanelMessage(m, client.user.id));
      } catch (historyError) {
        console.warn('⚠️ PANEL KLIENTA: nie udało się odczytać historii, wysyłam nowy panel:', historyError?.message || historyError);
      }

      // Najpierw próbujemy edytować najnowszy panel. Gdy wiadomość jest stara,
      // usunięta albo nieedytowalna, zawsze wysyłamy świeżą wiadomość.
      let target = panels.sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0] || null;
      if (target) {
        try {
          target = await target.edit(customerPanelPayload());
        } catch (editError) {
          console.warn('⚠️ PANEL KLIENTA: edycja starego panelu nie powiodła się:', editError?.message || editError);
          target = null;
        }
      }

      if (!target) target = await channel.send(customerPanelPayload());

      for (const old of panels) {
        if (old.id !== target.id) await old.delete().catch(() => {});
      }

      console.log(`✅ PANEL KLIENTA (${reason}): wiadomość=${target.id}, kanał=${CUSTOMER_PANEL_CHANNEL_ID}`);
      return target;
    })();

    try {
      return await customerPanelPromise;
    } finally {
      customerPanelPromise = null;
    }
  }

  async function replaceLegitPanel(reason) {
    panelQueue = panelQueue.then(async () => {
      const channel = await getTextChannel(LEGIT_CHANNEL_ID);
      const sent = await channel.send({ embeds: [legitPanelEmbed()] });
      let before;
      let scanned = 0;
      while (scanned < 500) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (!batch.size) break;
        scanned += batch.size;
        for (const msg of batch.values()) {
          if (msg.id !== sent.id && isLegitPanelMessage(msg, client.user.id)) await msg.delete().catch(() => {});
        }
        before = batch.last()?.id;
        if (batch.size < 100) break;
      }
      console.log(`✅ PANEL LC odświeżony (${reason}): ${sent.id}`);
    }).catch(err => console.error('❌ PANEL LC:', err?.stack || err));
    return panelQueue;
  }

  async function renameCounter(count) {
    const channel = await client.channels.fetch(LEGIT_CHANNEL_ID, { force: true });
    const name = `${LEGIT_PREFIX}${Math.max(0, count)}`;
    const settings = store.read('settings');
    settings.legitCount = Math.max(0, count);
    settings.legitCounterChannelId = LEGIT_CHANNEL_ID;
    settings.legitCounterChannelPrefix = LEGIT_PREFIX;
    store.write('settings', settings);
    if (channel.name === name) return;
    try {
      await channel.setName(name, 'Synchronizacja wiadomości +rep');
      console.log(`✅ LICZNIK LC: ${name}`);
    } catch (err) {
      const seconds = Number(err?.retry_after || err?.rawError?.retry_after || 0);
      const delay = seconds > 0 ? Math.ceil(seconds * 1000) + 1500 : 10 * 60 * 1000;
      console.error(`⚠️ LICZNIK LC oczekuje na limit Discorda (${Math.ceil(delay / 1000)}s):`, err?.message || err);
      clearTimeout(renameTimer);
      renameTimer = setTimeout(() => renameCounter(pendingCount).catch(console.error), delay);
    }
  }

  function scheduleRename() {
    pendingCount = repIds.size;
    clearTimeout(renameTimer);
    renameTimer = setTimeout(() => renameCounter(pendingCount).catch(err => console.error('❌ LICZNIK LC:', err?.stack || err)), 1200);
  }

  async function importRep(message, source) {
    const userId = await resolveCustomerId(message);
    if (!userId) return;
    store.importLegitTransaction({
      messageId: message.id,
      userId,
      amount: amountFrom(message.content),
      description: descriptionFrom(message.content),
      channelId: message.channelId,
      createdAt: message.createdAt?.toISOString?.() || new Date().toISOString(),
      source
    });
  }

  async function fullSync() {
    const channel = await getTextChannel(LEGIT_CHANNEL_ID);
    repIds.clear();
    let before;
    let scanned = 0;
    while (true) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!batch.size) break;
      scanned += batch.size;
      for (const msg of batch.values()) {
        if (!isRep(msg.content)) continue;
        repIds.add(msg.id);
        await importRep(msg, 'legit_history');
      }
      before = batch.last()?.id;
      if (batch.size < 100) break;
    }
    pendingCount = repIds.size;
    await renameCounter(pendingCount);
    console.log(`✅ LC SYNC: ${pendingCount} wiadomości +rep (sprawdzono ${scanned})`);
  }

  async function responseFor(interaction) {
    const choice = interaction.values?.[0];
    const base = title => new EmbedBuilder().setColor(BLUE).setTitle(title).setFooter({ text: '© 2026 StarX Exchange » Panel Klienta' });
    if (choice === 'stats') {
      const c = store.getCustomer(interaction.user.id);
      return { embeds: [base(`${EMOJI.money} Moje Statystyki`).setDescription(`${EMOJI.money} **Wydano:** ${money(c.spent)}\n${EMOJI.cart} **Transakcje:** ${c.transactions || 0}\n${EMOJI.clock} **Pierwszy zakup:** ${date(c.firstPurchaseAt)}\n${EMOJI.pin} **Ostatni zakup:** ${date(c.lastPurchaseAt)}`)] };
    }
    if (choice === 'history') {
      const txs = store.read('transactions').filter(t => t.userId === interaction.user.id).sort((a,b) => new Date(b.confirmedAt || b.createdAt || 0)-new Date(a.confirmedAt || a.createdAt || 0)).slice(0,5);
      return { embeds: [base(`${EMOJI.list} Historia Zakupów`).setDescription(txs.length ? txs.map((t,i)=>`${EMOJI.arrow} **${i+1}. ${t.description || 'Zakup'}**\n${EMOJI.money} ${money(t.amount)} • ${EMOJI.clock} ${date(t.confirmedAt || t.createdAt)}`).join('\n\n') : `${EMOJI.warning} Brak zapisanych zakupów.`)] };
    }
    if (choice === 'invites') {
      const n = interaction.guild ? store.getInviteCount(interaction.guild.id, interaction.user.id) : 0;
      return { embeds: [base(`${EMOJI.people} Zaproszenia`).setDescription(`${EMOJI.people} Masz **${n}** skutecznych zaproszeń.`)] };
    }
    if (choice === 'top5') {
      const top = Object.values(store.read('customers')).sort((a,b)=>Number(b.spent||0)-Number(a.spent||0)).slice(0,5);
      return { embeds: [base(`${EMOJI.admin} Top 5 Klientów`).setDescription(top.length ? top.map((c,i)=>`${EMOJI.arrow} **${i+1}.** <@${c.userId}> — ${EMOJI.money} **${money(c.spent)}**, ${c.transactions || 0} trans.`).join('\n') : `${EMOJI.warning} Brak danych.`)] };
    }
    return { content: '❌ Nie rozpoznano opcji.' };
  }

  client.once(Events.ClientReady, async () => {
    console.log('🚀 Uruchamianie wspólnego systemu Panel Klienta + LC...');
    await publishCustomerPanel('start').catch(err => console.error('❌ PANEL KLIENTA START:', err?.stack || err));
    await fullSync().catch(err => console.error('❌ LC SYNC START:', err?.stack || err));
    await replaceLegitPanel('start').catch(() => {});
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'panelklienta') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Brak uprawnień administratora.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      try {
        // Discord musi dostać potwierdzenie w ciągu 3 sekund.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const message = await publishCustomerPanel(`/panelklienta przez ${interaction.user.id}`);
        return interaction.editReply({
          content: `✅ Panel Klienta został odświeżony na <#${CUSTOMER_PANEL_CHANNEL_ID}>.\nID wiadomości: \`${message.id}\``
        });
      } catch (error) {
        console.error('❌ /panelklienta ERROR:', error?.stack || error);
        const text = `❌ Nie udało się wysłać Panelu Klienta na <#${CUSTOMER_PANEL_CHANNEL_ID}>. Sprawdź logi Railway: ${String(error?.message || error).slice(0, 500)}`;
        if (interaction.deferred || interaction.replied) return interaction.editReply({ content: text }).catch(() => {});
        return interaction.reply({ content: text, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    if (!interaction.isStringSelectMenu()) return;
    const looksLikePanel = interaction.customId === CUSTOMER_MENU_ID || (interaction.channelId === CUSTOMER_PANEL_CHANNEL_ID && interaction.message?.embeds?.some(e => String(e.title || '').toUpperCase().includes('PANEL KLIENTA')));
    if (!looksLikePanel) return;
    try {
      // Odpowiedź wysyłamy natychmiast; brak deferUpdate/followUp eliminuje timeout starego menu.
      const payload = await responseFor(interaction);
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('❌ PANEL INTERACTION:', err?.stack || err);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Błąd Panelu Klienta. Sprawdź logi Railway.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  client.on(Events.MessageCreate, async message => {
    if (message.channelId !== LEGIT_CHANNEL_ID || !isRep(message.content)) return;
    if (!repIds.has(message.id)) {
      repIds.add(message.id);
      await importRep(message, 'legit_live').catch(err => console.error('❌ IMPORT +REP:', err));
    }
    scheduleRename();
    replaceLegitPanel(`+rep ${message.id}`);
  });

  client.on(Events.MessageDelete, async message => {
    if (message.channelId !== LEGIT_CHANNEL_ID) return;
    const known = repIds.delete(message.id);
    const removed = store.removeLegitTransactionByMessageId(message.id).removed;
    if (known || removed || isRep(message.content)) scheduleRename();
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (newMessage.channelId !== LEGIT_CHANNEL_ID) return;
    if (newMessage.partial) newMessage = await newMessage.fetch().catch(() => newMessage);
    const before = repIds.has(newMessage.id) || isRep(oldMessage.content);
    const after = isRep(newMessage.content);
    if (before && !after) {
      repIds.delete(newMessage.id);
      store.removeLegitTransactionByMessageId(newMessage.id);
      scheduleRename();
    } else if (!before && after) {
      repIds.add(newMessage.id);
      await importRep(newMessage, 'legit_update');
      scheduleRename();
      replaceLegitPanel(`edycja +rep ${newMessage.id}`);
    } else if (after) {
      store.updateLegitTransactionByMessageId(newMessage.id, { amount: amountFrom(newMessage.content), description: descriptionFrom(newMessage.content), content: newMessage.content });
    }
  });
};
