const {
  Events,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

module.exports = client => {
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'autolc') {
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Brak uprawnień administratora.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }

    const user = interaction.options.getUser('uzytkownik', true);
    const text = interaction.options.getString('tekst', true);

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!interaction.channel?.isTextBased?.() || typeof interaction.channel.createWebhook !== 'function') {
        throw new Error('Na tym kanale nie można utworzyć webhooka.');
      }

      const webhook = await interaction.channel.createWebhook({
        name: `${user.username} [ Automatyczne LC ]`,
        avatar: user.displayAvatarURL({ extension: 'png', size: 256 })
      });

      try {
        await webhook.send({ content: text });
      } finally {
        await webhook.delete('Usunięcie tymczasowego webhooka AutoLC').catch(() => {});
      }

      return interaction.editReply({
        content: '✅ Automatyczne LC zostało wysłane.'
      });
    } catch (error) {
      console.error('❌ AUTOLC:', error?.stack || error);

      const payload = {
        content: `❌ Nie udało się wysłać automatycznego LC: ${String(error?.message || error).slice(0, 300)}`
      };

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload).catch(() => {});
      }

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  });
};
