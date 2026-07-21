const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
const { upsertPanel } = require('./panelManager');
const store = require('./dataStore');

module.exports = (client) => {
  const PANEL_CHANNEL_ID = '1529242794621665371';
  const COLOR = '#1b2dff';

  const money = value => `${Number(value || 0).toFixed(2)} PLN`;
  const discordDate = iso => iso ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>` : 'Brak';

  async function sendPanel() {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return console.log('❌ Nie znaleziono kanału panelu klienta.');

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🌟 StarX Exchange × PANEL KLIENTA')
      .setDescription('Wybierz opcję poniżej, aby sprawdzić swoje dane i ranking klientów.')
      .setFooter({ text: '© 2026 StarX Exchange' });

    const first = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('customer_stats').setLabel('Moje Statystyki').setEmoji('📊').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('customer_history').setLabel('Historia zakupów').setEmoji('📜').setStyle(ButtonStyle.Secondary)
    );
    const second = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('customer_invites').setLabel('Zaproszenia').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('customer_top5').setLabel('Top 5 klientów').setEmoji('🏆').setStyle(ButtonStyle.Secondary)
    );

    await upsertPanel(channel, { embeds: [embed], components: [first, second] }, { customId: 'customer_stats' });
  }

  client.once(Events.ClientReady, sendPanel);

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('customer_')) return;

    if (interaction.customId === 'customer_stats') {
      const customer = store.getCustomer(interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📊 Twoje statystyki')
        .setDescription([
          `**Wydano:** ${money(customer.spent)}`,
          `**Transakcje:** ${customer.transactions || 0}`,
          `**Pierwszy zakup:** ${discordDate(customer.firstPurchaseAt)}`,
          `**Ostatni zakup:** ${discordDate(customer.lastPurchaseAt)}`
        ].join('\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.customId === 'customer_history') {
      const history = store.read('transactions')
        .filter(tx => tx.userId === interaction.user.id)
        .slice(-5)
        .reverse();
      const description = history.length
        ? history.map((tx, index) => `**${index + 1}. ${tx.description}**\n${money(tx.amount)} • ${discordDate(tx.createdAt)}`).join('\n\n')
        : 'Brak zapisanych zakupów.';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('📜 Ostatnie 5 zakupów').setDescription(description)], ephemeral: true });
    }

    if (interaction.customId === 'customer_invites') {
      const count = store.getInviteCount(interaction.guild.id, interaction.user.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('👥 Twoje zaproszenia').setDescription(`Masz **${count}** skutecznych zaproszeń.`)], ephemeral: true });
    }

    if (interaction.customId === 'customer_top5') {
      const customers = Object.values(store.read('customers'))
        .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
        .slice(0, 5);
      const description = customers.length
        ? customers.map((customer, index) => `**${index + 1}.** <@${customer.userId}> — **${money(customer.spent)}** (${customer.transactions || 0} trans.)`).join('\n')
        : 'Brak danych w rankingu.';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🏆 Top 5 klientów').setDescription(description)], ephemeral: true });
    }
  });
};
