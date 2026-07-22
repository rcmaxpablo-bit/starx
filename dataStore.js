const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const store = require('./dataStore');

const PANEL_CHANNEL_ID = '1529242794621665371';
const PANEL_CUSTOM_ID = 'starx_customer_panel_v5';
const COLOR = 0x1b2dff;

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
  warning: '<:PILNE:1501693444030992395>'
};

const OLD_CUSTOM_IDS = new Set([
  'customer_panel_select',
  'customer_panel_select_v2',
  'customer_panel_select_v3',
  'customer_panel_menu',
  'panel_klienta_select',
  'client_panel_select',
  PANEL_CUSTOM_ID
]);

function money(value) {
  return `${Number(value || 0).toFixed(2)} PLN`;
}

function discordDate(value) {
  if (!value) return 'Brak';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Brak';
  return `<t:${Math.floor(time / 1000)}:d>`;
}

function baseEmbed(title) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(title)
    .setFooter({ text: '© 2026 StarX Exchange » Panel Klienta' });
}

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('StarX Exchange » PANEL KLIENTA')
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
    .setCustomId(PANEL_CUSTOM_ID)
    .setPlaceholder('❌ | Nie wybrano żadnej opcji.')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Moje Statystyki')
        .setDescription('Sprawdź wydaną kwotę i liczbę transakcji.')
        .setValue('stats')
        .setEmoji({ id: '1501685438103031920', animated: true }),
      new StringSelectMenuOptionBuilder()
        .setLabel('Historia Zakupów')
        .setDescription('Zobacz 5 ostatnich zakupów.')
        .setValue('history')
        .setEmoji({ id: '1501693215328440370' }),
      new StringSelectMenuOptionBuilder()
        .setLabel('Sprawdź Zaproszenia')
        .setDescription('Sprawdź liczbę swoich zaproszeń.')
        .setValue('invites')
        .setEmoji({ id: '1500243884733894716' }),
      new StringSelectMenuOptionBuilder()
        .setLabel('Top 5 Klientów')
        .setDescription('Ranking klientów wydających najwięcej.')
        .setValue('top5')
        .setEmoji({ id: '1501989271077388500' })
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function isCustomerPanelInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (OLD_CUSTOM_IDS.has(interaction.customId)) return true;
  if (interaction.channelId !== PANEL_CHANNEL_ID) return false;
  return interaction.message?.embeds?.some(embed =>
    String(embed.title || '').toUpperCase().includes('PANEL KLIENTA')
  ) || false;
}

async function buildResponse(interaction) {
  const selected = interaction.values?.[0];

  if (selected === 'stats') {
    const customer = store.getCustomer(interaction.user.id);
    return {
      embeds: [baseEmbed(`${EMOJI.money} Moje Statystyki`).setDescription([
        `${EMOJI.money} **Wydano:** ${money(customer.spent)}`,
        `${EMOJI.cart} **Liczba transakcji:** ${customer.transactions || 0}`,
        `${EMOJI.clock} **Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
        `${EMOJI.pin} **Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
      ].join('\n'))]
    };
  }

  if (selected === 'history') {
    const history = store.read('transactions')
      .filter(tx => tx.userId === interaction.user.id)
      .sort((a, b) => new Date(b.confirmedAt || b.createdAt || 0) - new Date(a.confirmedAt || a.createdAt || 0))
      .slice(0, 5);

    const description = history.length
      ? history.map((tx, index) => [
          `${EMOJI.arrow} **${index + 1}. ${tx.description || 'Zakup'}**`,
          `${EMOJI.money} ${money(tx.amount)} • ${EMOJI.clock} ${discordDate(tx.confirmedAt || tx.createdAt)}`
        ].join('\n')).join('\n\n')
      : `${EMOJI.warning} Brak zapisanych zakupów.`;

    return { embeds: [baseEmbed(`${EMOJI.list} Historia Zakupów`).setDescription(description)] };
  }

  if (selected === 'invites') {
    const count = interaction.guild
      ? store.getInviteCount(interaction.guild.id, interaction.user.id)
      : 0;
    return {
      embeds: [baseEmbed(`${EMOJI.people} Sprawdź Zaproszenia`).setDescription(
        `${EMOJI.people} Masz **${count}** skutecznych zaproszeń.`
      )]
    };
  }

  if (selected === 'top5') {
    const customers = Object.values(store.read('customers'))
      .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
      .slice(0, 5);
    const description = customers.length
      ? customers.map((customer, index) =>
          `${EMOJI.arrow} **${index + 1}.** <@${customer.userId}>\n${EMOJI.money} **${money(customer.spent)}** • ${EMOJI.cart} ${customer.transactions || 0} trans.`
        ).join('\n\n')
      : `${EMOJI.warning} Brak danych w rankingu.`;
    return { embeds: [baseEmbed(`${EMOJI.admin} Top 5 Klientów`).setDescription(description)] };
  }

  return { content: '❌ Nie rozpoznano wybranej opcji.' };
}

module.exports = client => {
  let panelOperation = null;

  async function publishPanel(reason = 'start') {
    if (panelOperation) return panelOperation;
    panelOperation = (async () => {
      try {
        const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
        if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
          throw new Error(`Kanał ${PANEL_CHANNEL_ID} nie jest kanałem tekstowym.`);
        }

        const me = channel.guild?.members?.me;
        const perms = me ? channel.permissionsFor(me) : null;
        for (const permission of [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory
        ]) {
          if (perms && !perms.has(permission)) {
            throw new Error(`Brak uprawnienia ${permission.toString()} na kanale ${PANEL_CHANNEL_ID}.`);
          }
        }

        const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        const oldPanels = recent
          ? [...recent.values()].filter(message =>
              message.author?.id === client.user.id &&
              (message.embeds?.some(embed => String(embed.title || '').toUpperCase().includes('PANEL KLIENTA')) ||
               message.components?.some(row => row.components?.some(component => OLD_CUSTOM_IDS.has(component.customId))))
            )
          : [];

        let message = oldPanels.sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
        if (message) {
          message = await message.edit(panelPayload()).catch(() => null);
        }
        if (!message) message = await channel.send(panelPayload());

        for (const old of oldPanels) {
          if (old.id !== message.id) await old.delete().catch(() => {});
        }

        console.log(`✅ PANEL KLIENTA OK (${reason}): kanał=${PANEL_CHANNEL_ID}, wiadomość=${message.id}, customId=${PANEL_CUSTOM_ID}`);
        return true;
      } catch (error) {
        console.error(`❌ PANEL KLIENTA ERROR (${reason}):`, error?.stack || error);
        return false;
      } finally {
        panelOperation = null;
      }
    })();
    return panelOperation;
  }

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'panelklienta') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Brak uprawnień.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      const ok = await publishPanel('komenda /panelklienta');
      return interaction.editReply(ok
        ? `✅ Panel działa na <#${PANEL_CHANNEL_ID}>.`
        : '❌ Nie udało się wysłać panelu. Sprawdź logi Railway.'
      ).catch(() => {});
    }

    if (!isCustomerPanelInteraction(interaction)) return;

    console.log(`ℹ️ PANEL KLIK: user=${interaction.user.id}, customId=${interaction.customId}, value=${interaction.values?.[0]}`);

    // deferUpdate potwierdza kliknięcie menu natychmiast i nie czeka na odczyt JSON.
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    } catch (error) {
      console.error('❌ PANEL ACK ERROR:', error?.code, error?.message || error);
      return;
    }

    try {
      const response = await buildResponse(interaction);
      await interaction.followUp({ ...response, flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('❌ PANEL RESPONSE ERROR:', error?.stack || error);
      await interaction.followUp({
        content: '❌ Wystąpił błąd podczas odczytu danych panelu.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  });

  const ready = async () => {
    await publishPanel('uruchomienie');
    setTimeout(() => publishPanel('kontrola po 10 s'), 10000);
  };

  if (client.isReady()) ready();
  else client.once(Events.ClientReady, ready);
};
