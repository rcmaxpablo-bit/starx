const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags
} = require('discord.js');
const { upsertPanel } = require('./panelManager');
const store = require('./dataStore');

module.exports = (client) => {
  const PANEL_CHANNEL_ID = '1529242794621665371';
  const COLOR = '#1b2dff';

  const money = value => `${Number(value || 0).toFixed(2)} PLN`;
  const discordDate = iso => iso
    ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`
    : 'Brak';

  function createButtons() {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('customer_stats')
          .setLabel('Moje Statystyki')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('customer_history')
          .setLabel('Historia zakupów')
          .setEmoji('📜')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('customer_invites')
          .setLabel('Zaproszenia')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('customer_top5')
          .setLabel('Top 5 klientów')
          .setEmoji('🏆')
          .setStyle(ButtonStyle.Secondary)
      )
    ];
  }

  async function sendPanel() {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      return console.log('❌ Nie znaleziono kanału panelu klienta.');
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🌟 StarX Exchange » PANEL KLIENTA')
      .setDescription('Wybierz opcję poniżej, aby sprawdzić swoje dane i ranking klientów.')
      .setFooter({ text: '© 2026 StarX Exchange' });

    await upsertPanel(
      channel,
      { embeds: [embed], components: createButtons() },
      { customId: 'customer_stats', embedTitle: '🌟 StarX Exchange » PANEL KLIENTA' }
    );
  }

  client.once(Events.ClientReady, sendPanel);

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('customer_')) return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.log('❌ Nie udało się potwierdzić interakcji panelu klienta:', error);
      return;
    }

    if (interaction.customId === 'customer_stats') {
      const customer = store.getCustomer(interaction.user.id);
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📊 Moje Statystyki')
        .setDescription([
          `**Wydano:** ${money(customer.spent)}`,
          `**Liczba transakcji:** ${customer.transactions || 0}`,
          `**Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
          `**Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
        ].join('\n'))] });
    }

    if (interaction.customId === 'customer_history') {
      const history = store.read('transactions')
        .filter(tx => tx.userId === interaction.user.id)
        .slice(-5)
        .reverse();
      const description = history.length
        ? history.map((tx, i) => `**${i + 1}. ${tx.description}**\n${money(tx.amount)} • ${discordDate(tx.createdAt)}`).join('\n\n')
        : 'Brak zapisanych zakupów.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('📜 Historia zakupów').setDescription(description)] });
    }

    if (interaction.customId === 'customer_invites') {
      const count = store.getInviteCount(interaction.guild.id, interaction.user.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('👥 Zaproszenia').setDescription(`Masz **${count}** skutecznych zaproszeń.`)] });
    }

    if (interaction.customId === 'customer_top5') {
      const customers = Object.values(store.read('customers'))
        .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
        .slice(0, 5);
      const description = customers.length
        ? customers.map((c, i) => `**${i + 1}.** <@${c.userId}> — **${money(c.spent)}** (${c.transactions || 0} trans.)`).join('\n')
        : 'Brak danych w rankingu.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🏆 Top 5 klientów').setDescription(description)] });
    }
  });
};
