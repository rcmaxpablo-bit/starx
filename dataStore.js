const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
  MessageFlags
} = require('discord.js');
const { upsertPanel } = require('./panelManager');
const store = require('./dataStore');

const EMOJI = {
  ticket: '<:TICKET:1501697124734206032>',
  pin: '<:PIN:1501697389050986546>',
  zap: '<:PIORUN:1501697151737139350>',
  lock: '<:ZAMKNIETE:1501697222901895258>',
  unlock: '<:OTWARTE:1510596058470809690>',
  warning: '<:PILNE:1501693444030992395>',
  support: '<:WSPARCIE:1500243961124618381>',
  admin: '<:ADM:1501989271077388500>',
  list: '<:LIST:1501693215328440370>',
  clock: '<:CZAS:1502030015943151868>',
  money: '<a:m_:1501685438103031920>',
  arrow: '<a:Arrow_White:1508094625984811038>',
  middleman: '<:LUDZIE:1500243884733894716>',
  cart: '<:SKLEP:1500243849535033577>'
};

const MENU_EMOJI = {
  stats: { id: '1501685438103031920', animated: true },
  history: { id: '1501693215328440370' },
  top5: { id: '1501989271077388500' },
  invites: { id: '1500243884733894716' }
};

module.exports = (client) => {
  const PANEL_CHANNEL_ID = '1529242794621665371';
  const COLOR = '#1b2dff';

  const money = value => `${Number(value || 0).toFixed(2)} PLN`;
  const discordDate = iso => iso
    ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`
    : 'Brak';

  function baseEmbed(title) {
    return new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(title)
      .setFooter({ text: '© 2026 StarX Exchange' });
  }

  function createMenu() {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('customer_panel_select_v2')
      .setPlaceholder('❌ | Nie wybrano żadnej opcji.')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Moje Statystyki')
          .setDescription('Sprawdź wydaną kwotę i liczbę transakcji.')
          .setValue('stats')
          .setEmoji(MENU_EMOJI.stats),
        new StringSelectMenuOptionBuilder()
          .setLabel('Historia Zakupów')
          .setDescription('Zobacz swoich 5 ostatnich zakupów.')
          .setValue('history')
          .setEmoji(MENU_EMOJI.history),
        new StringSelectMenuOptionBuilder()
          .setLabel('Top 5 Klientów')
          .setDescription('Ranking klientów wydających najwięcej.')
          .setValue('top5')
          .setEmoji(MENU_EMOJI.top5),
        new StringSelectMenuOptionBuilder()
          .setLabel('Sprawdź Zaproszenia')
          .setDescription('Sprawdź liczbę swoich zaproszeń.')
          .setValue('invites')
          .setEmoji(MENU_EMOJI.invites)
      );

    return new ActionRowBuilder().addComponents(menu);
  }

  async function sendPanel() {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      return console.log('❌ Nie znaleziono kanału panelu klienta.');
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('StarX Exchange » PANEL KLIENTA')
      .setDescription([
        `${EMOJI.support} **Wybierz odpowiednią opcję z menu poniżej.**`,
        '',
        `${EMOJI.money} Statystyki wydatków i transakcji`,
        `${EMOJI.list} Historia ostatnich zakupów`,
        `${EMOJI.middleman} Twoje zaproszenia`,
        `${EMOJI.admin} Ranking Top 5 klientów`
      ].join('\n'))
      .setFooter({ text: '© 2026 StarX Exchange » Panel Klienta' });

    // Usuń stare wersje panelu i wyślij całkowicie nową wiadomość.
    // Dzięki temu Discord nie pozostawia komponentów ze starym customId,
    // które po aktualizacji kodu mogły wyświetlać błąd braku odpowiedzi.
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      for (const message of messages.values()) {
        if (message.author?.id !== client.user.id) continue;

        const isCustomerPanel = message.embeds?.some(e =>
          String(e.title || '').toUpperCase().includes('PANEL KLIENTA')
        );
        const hasOldComponent = message.components?.some(row =>
          row.components?.some(component =>
            ['customer_panel_select', 'customer_panel_select_v2'].includes(component.customId)
          )
        );

        if (isCustomerPanel || hasOldComponent) {
          await message.delete().catch(() => {});
        }
      }
    } catch (error) {
      console.log('⚠️ Nie udało się usunąć starego panelu klienta:', error.message);
    }

    await channel.send({ embeds: [embed], components: [createMenu()] });
    console.log('✅ Wysłano nowy Panel Klienta (customer_panel_select_v2).');
  }

  client.once(Events.ClientReady, sendPanel);

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'customer_panel_select_v2') return;

    // Potwierdź wybór natychmiast, zanim odczytamy pliki i zbudujemy embed.
    // deferUpdate() aktualizuje stan komponentu i zapobiega komunikatowi
    // „Aplikacja nie odpowiedziała na czas”. Wynik wysyłamy prywatnie przez followUp().
    try {
      await interaction.deferUpdate();
    } catch (error) {
      console.log('❌ Nie udało się potwierdzić interakcji panelu klienta:', error);
      return;
    }

    const selected = interaction.values[0];
    const sendPrivate = payload => interaction.followUp({
      ...payload,
      flags: MessageFlags.Ephemeral
    }).catch(error => console.log('❌ Błąd odpowiedzi panelu klienta:', error));

    if (selected === 'stats') {
      const customer = store.getCustomer(interaction.user.id);
      return sendPrivate({ embeds: [baseEmbed('Moje Statystyki')
        .setDescription([
          `${EMOJI.money} **Wydano:** ${money(customer.spent)}`,
          `${EMOJI.cart} **Liczba transakcji:** ${customer.transactions || 0}`,
          `${EMOJI.clock} **Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
          `${EMOJI.pin} **Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
        ].join('\n'))] });
    }

    if (selected === 'history') {
      const history = store.read('transactions')
        .filter(tx => tx.userId === interaction.user.id)
        .slice(-5)
        .reverse();
      const description = history.length
        ? history.map((tx, i) => `${EMOJI.arrow} **${i + 1}. ${tx.description}**\n${EMOJI.money} ${money(tx.amount)}  ${EMOJI.clock} ${discordDate(tx.createdAt)}`).join('\n\n')
        : `${EMOJI.warning} Brak zapisanych zakupów.`;
      return sendPrivate({ embeds: [baseEmbed('Historia Zakupów').setDescription(description)] });
    }

    if (selected === 'invites') {
      const count = interaction.guild ? store.getInviteCount(interaction.guild.id, interaction.user.id) : 0;
      return sendPrivate({ embeds: [baseEmbed('Sprawdź Zaproszenia')
        .setDescription(`${EMOJI.middleman} Masz **${count}** skutecznych zaproszeń.\n\n${EMOJI.zap} Zapraszaj aktywnych użytkowników i rozwijaj społeczność StarX Exchange.`)] });
    }

    if (selected === 'top5') {
      const customers = Object.values(store.read('customers'))
        .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
        .slice(0, 5);
      const description = customers.length
        ? customers.map((c, i) => `${EMOJI.arrow} **${i + 1}.** <@${c.userId}>\n${EMOJI.money} **${money(c.spent)}** • ${EMOJI.cart} ${c.transactions || 0} trans.`).join('\n\n')
        : `${EMOJI.warning} Brak danych w rankingu.`;
      return sendPrivate({ embeds: [baseEmbed('Top 5 Klientów').setDescription(description)] });
    }
  });
};
