const { Events, PermissionFlagsBits } = require("discord.js");

module.exports = (client) => {
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "autolc") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Brak permisji.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("uzytkownik");
    const text = interaction.options.getString("tekst");

    try {
      const webhook = await interaction.channel.createWebhook({
        name: `${user.username} [ Automatyczne LC ]`,
        avatar: user.displayAvatarURL()
      });

      await webhook.send({ content: text });

      setTimeout(() => {
        webhook.delete().catch(() => {});
      }, 5000);

      await interaction.reply({
        content: "✅ Automatyczne LC wysłane.",
        ephemeral: true
      });
    } catch (err) {
      console.error("AUTOLC ERROR:", err?.stack || err);
      const payload = {
        content: "❌ Błąd podczas wysyłania LC.",
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });
};
