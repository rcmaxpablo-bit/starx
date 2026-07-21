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
  const ARROW_EMOJI_ID = '1508094625984811038';

  const money = value => `${Number(value || 0).toFixed(2)} PLN`;
  const discordDate = iso => iso
    ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`
    : 'Brak';

  function createMenu() {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('customer_panel_select')
      .setPlaceholder('❌ | Nie wybrano żadnej opcji.')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Moje Statystyki')
          .setDescription('Ile wydałeś i ile masz transakcji.')
          .setValue('stats')
          .setEmoji({ id: ARROW_EMOJI_ID, animated: true }),
        new StringSelectMenuOptionBuilder()
          .setLabel('Historia Zakupów')
          .setDescription('Twoje ostatnie 5 zakupów.')
          .setValue('history')
          .setEmoji({ id: ARROW_EMOJI_ID, animated: true }),
        new StringSelectMenuOptionBuilder()
          .setLabel('Top 5 Klientów')
          .setDescription('Ranking najwięcej wydających.')
          .setValue('top5')
          .setEmoji({ id: ARROW_EMOJI_ID, animated: true }),
        new StringSelectMenuOptionBuilder()
          .setLabel('Sprawdź Zaproszenia')
          .setDescription('Ile masz zaproszeń i kogo ostatnio zaprosiłeś.')
          .setValue('invites')
          .setEmoji({ id: ARROW_EMOJI_ID, animated: true })
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
      .setTitle('🌟 StarX Exchange » PANEL KLIENTA')
      .setDescription('🔒︱Wybierz odpowiednią opcję poniżej.')
      .setFooter({ text: '© 2026 StarX Exchange » Panel Klienta' });

    await upsertPanel(
      channel,
      { embeds: [embed], components: [createMenu()] },
      { customId: 'customer_panel_select', embedTitle: '🌟 StarX Exchange » PANEL KLIENTA' }
    );
  }

  client.once(Events.ClientReady, sendPanel);

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'customer_panel_select') return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.log('❌ Nie udało się potwierdzić interakcji panelu klienta:', error);
      return;
    }

    const selected = interaction.values[0];

    if (selected === 'stats') {
      const customer = store.getCustomer(interaction.user.id);
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📊 Moje Statystyki')
        .setDescription([
          `**Wydano:** ${money(customer.spent)}`,
          `**Liczba transakcji:** ${customer.transactions || 0}`,
          `**Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
          `**Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
        ].join('\n'))
        .setFooter({ text: '© 2026 StarX Exchange' })] });
    }

    if (selected === 'history') {
      const history = store.read('transactions')
        .filter(tx => tx.userId === interaction.user.id)
        .slice(-5)
        .reverse();
      const description = history.length
        ? history.map((tx, i) => `**${i + 1}. ${tx.description}**\n${money(tx.amount)} • ${discordDate(tx.createdAt)}`).join('\n\n')
        : 'Brak zapisanych zakupów.';
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📜 Historia Zakupów')
        .setDescription(description)
        .setFooter({ text: '© 2026 StarX Exchange' })] });
    }

    if (selected === 'invites') {
      const count = interaction.guild ? store.getInviteCount(interaction.guild.id, interaction.user.id) : 0;
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('👥 Sprawdź Zaproszenia')
        .setDescription(`Masz **${count}** skutecznych zaproszeń.`)
        .setFooter({ text: '© 2026 StarX Exchange' })] });
    }

    if (selected === 'top5') {
      const customers = Object.values(store.read('customers'))
        .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
        .slice(0, 5);
      const description = customers.length
        ? customers.map((c, i) => `**${i + 1}.** <@${c.userId}> — **${money(c.spent)}** (${c.transactions || 0} trans.)`).join('\n')
        : 'Brak danych w rankingu.';
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🏆 Top 5 Klientów')
        .setDescription(description)
        .setFooter({ text: '© 2026 StarX Exchange' })] });
    }
  });
};
