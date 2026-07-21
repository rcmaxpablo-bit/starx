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

module.exports = (client) => {
  const PANEL_CHANNEL_ID = '1529242794621665371';
  const COLOR = '#1b2dff';

  // Emotki używane wcześniej w bocie.
  const EMOJIS = {
    arrow: { id: '1508094625984811038', animated: true },
    lock: '<:lock:1501697222901895258>',
    money: '<a:money:1501685438103031920>',
    list: '<:LIST:1501693215328440370>',
    people: '<:LUDZIE:1500243884733894716>',
    shop: '<:SKLEP:1500243849535033577>'
  };

  const money = value => `${Number(value || 0).toFixed(2)} PLN`;
  const discordDate = iso => iso
    ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`
    : 'Brak';

  function createMenu() {
    return new StringSelectMenuBuilder()
      .setCustomId('customer_panel_select')
      .setPlaceholder('❌ | Nie wybrano żadnej opcji.')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Moje Statystyki')
          .setDescription('Ile wydałeś i ile masz transakcji.')
          .setValue('customer_stats')
          .setEmoji(EMOJIS.arrow),
        new StringSelectMenuOptionBuilder()
          .setLabel('Historia Zakupów')
          .setDescription('Twoje ostatnie 5 zakupów.')
          .setValue('customer_history')
          .setEmoji(EMOJIS.arrow),
        new StringSelectMenuOptionBuilder()
          .setLabel('Top 5 Klientów')
          .setDescription('Ranking najwięcej wydających.')
          .setValue('customer_top5')
          .setEmoji(EMOJIS.arrow),
        new StringSelectMenuOptionBuilder()
          .setLabel('Sprawdź Zaproszenia')
          .setDescription('Ile masz zaproszeń i kogo ostatnio zaprosiłeś.')
          .setValue('customer_invites')
          .setEmoji(EMOJIS.arrow)
      );
  }

  async function sendPanel() {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      return console.log('❌ Nie znaleziono kanału panelu klienta.');
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🌟 StarX Exchange » PANEL KLIENTA')
      .setDescription([
        `${EMOJIS.lock} | Wybierz odpowiednią opcję poniżej.`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `${EMOJIS.money} Statystyki i wydana kwota`,
        `${EMOJIS.list} Historia ostatnich zakupów`,
        `${EMOJIS.people} Zaproszenia`,
        `${EMOJIS.shop} Top 5 klientów`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n'))
      .setFooter({ text: '© 2026 StarX Exchange • Panel Klienta' });

    const row = new ActionRowBuilder().addComponents(createMenu());

    await upsertPanel(
      channel,
      { embeds: [embed], components: [row] },
      { customId: 'customer_panel_select', embedTitle: '🌟 StarX Exchange × PANEL KLIENTA' }
    );
  }

  client.once(Events.ClientReady, sendPanel);

  client.on(Events.InteractionCreate, async interaction => {
    let selectedAction = null;

    if (interaction.isStringSelectMenu() && interaction.customId === 'customer_panel_select') {
      selectedAction = interaction.values[0];
    }

    // Zachowana zgodność ze starymi przyciskami, gdyby gdzieś została ich kopia.
    if (interaction.isButton() && interaction.customId.startsWith('customer_')) {
      selectedAction = interaction.customId;
    }

    if (!selectedAction) return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.log('❌ Nie udało się potwierdzić interakcji panelu klienta:', error);
      return;
    }

    if (selectedAction === 'customer_stats') {
      const customer = store.getCustomer(interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`${EMOJIS.money} Twoje Statystyki`)
        .setDescription([
          `**Wydano:** ${money(customer.spent)}`,
          `**Liczba transakcji:** ${customer.transactions || 0}`,
          `**Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
          `**Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
        ].join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (selectedAction === 'customer_history') {
      const history = store.read('transactions')
        .filter(tx => tx.userId === interaction.user.id)
        .slice(-5)
        .reverse();

      const description = history.length
        ? history
          .map((tx, index) => `**${index + 1}. ${tx.description}**\n${money(tx.amount)} • ${discordDate(tx.createdAt)}`)
          .join('\n\n')
        : 'Brak zapisanych zakupów.';

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`${EMOJIS.list} Ostatnie 5 Zakupów`)
            .setDescription(description)
        ]
      });
    }

    if (selectedAction === 'customer_invites') {
      const count = store.getInviteCount(interaction.guild.id, interaction.user.id);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`${EMOJIS.people} Twoje Zaproszenia`)
            .setDescription(`Masz **${count}** skutecznych zaproszeń.`)
        ]
      });
    }

    if (selectedAction === 'customer_top5') {
      const customers = Object.values(store.read('customers'))
        .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
        .slice(0, 5);

      const description = customers.length
        ? customers
          .map((customer, index) => `**${index + 1}.** <@${customer.userId}> — **${money(customer.spent)}** (${customer.transactions || 0} trans.)`)
          .join('\n')
        : 'Brak danych w rankingu.';

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`${EMOJIS.shop} Top 5 Klientów`)
            .setDescription(description)
        ]
      });
    }
  });
};
