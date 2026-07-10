// propozycje.js SMALL PREMIUM

const {
  EmbedBuilder,
  Events
} = require("discord.js");

module.exports = (client) => {

  const CHANNEL_ID = "1499573354712010872";

  const EMOJI = {
    pin: "<:pin:1501697389050986546>",
    green: "<a:green:1501990166082879538>"
  };

  client.on(Events.MessageCreate, async (message) => {

    try {

      if (message.author.bot) return;
      if (message.channel.id !== CHANNEL_ID) return;
      if (!message.content) return;

      // usuń wiadomość użytkownika
      await message.delete().catch(() => {});

      const now = new Date().toLocaleString("pl-PL");

      // embed
      const embed = new EmbedBuilder()

        .setColor('#1b2dff')

        .setTitle("🌟 StarX Exchange » Propozycja")

        .setDescription(
`${EMOJI.green} Autor: <@${message.author.id}>

${EMOJI.pin} Propozycja:
\`\`\`
${message.content}
\`\`\`

📅 ${now}`
        )

        .setThumbnail(
          message.author.displayAvatarURL({
            dynamic: true
          })
        )

        .setFooter({
          text: "© 2026 StarX Exchange"
        });

      // wyślij embed
      const sent = await message.channel.send({
        embeds: [embed]
      });

      // reakcje
      await sent.react("✅");
      await sent.react("❌");

      // thread
      await sent.startThread({
        name: `Dyskusja • ${message.author.username}`,
        autoArchiveDuration: 1440
      });

    } catch (err) {

      console.log("❌ propozycje error:", err);
    }
  });
};
