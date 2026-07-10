const { EmbedBuilder, Events } = require("discord.js");

module.exports = (client) => {

  const WELCOME_CHANNEL_ID = "1499527016347865399";

  // =====================
  // EMOJI
  // =====================
  const EMOJI = {
    wave: "👋",
    ticket: "🎫",
    legit: "✅",
    calc: "🧮",

    exchange: "<:exchange:1508159193792647248>",

    users: "<:users:1500243884733894716>",

    green: "<a:green:1501990166082879538>",
    zap: "<:zap:1501697151737139350>",
    pin: "<:pin:1501697389050986546>",
    lock: "<:lock:1501697222901895258>"
  };

  // =====================
  // MEMBER JOIN
  // =====================
  client.on(Events.GuildMemberAdd, async (member) => {

    try {

      const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);

      if (!channel) {
        return console.log("❌ Nie znaleziono kanału welcome");
      }

      // liczba osób
      const memberCount = member.guild.memberCount;

      // =====================
      // EMBED
      // =====================
      const embed = new EmbedBuilder()

        .setColor('#1b2dff')

        .setTitle(`${EMOJI.wave} StarX Exchange » Welcome`)

        .setDescription(
[
`## ${EMOJI.green} Witaj na serwerze!`,
`> ${member} miło Cię widzieć na **StarX Exchange**`,
`> Jesteś **${memberCount}** osobą na serwerze 🔥`,
``,
`## ${EMOJI.pin} Ważne kanały`,
`> ${EMOJI.exchange} Wymiany — <#1499513009188376767>`,
`> ${EMOJI.ticket} Tickety — <#1509429804770791494>`,
`> ${EMOJI.legit} Legit Check — <#1499519884860854505>`,
`> ⭐ Opinie — <#1499519935657935049>`,
`> ${EMOJI.calc} Kalkulator — <#1499568863602540645>`,
``,
`## ${EMOJI.lock} Weryfikacja`,
`> Wejdź na <#1499725942313058344>`,
`> Zweryfikuj się aby uzyskać`,
`> pełny dostęp do serwera 🔓`,
``,
`## ${EMOJI.zap} Informacje`,
`> Zachowuj kulturę`,
`> Przeczytaj regulamin`,
`> Życzymy udanych wymian 🔥`
].join("\n")
        )

        .setThumbnail(
          member.user.displayAvatarURL({
            dynamic: true,
            size: 1024
          })
        )

        .setImage(
          "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand"
        )

        .setFooter({
          text: "© 2026 StarX Exchange"
        })

        .setTimestamp();

      // =====================
      // SEND
      // =====================
      await channel.send({
        content: `${EMOJI.wave} ${member}`,
        embeds: [embed]
      });

      console.log(`✅ Welcome sent: ${member.user.tag}`);

    } catch (err) {

      console.log("❌ Welcome error:", err);
    }
  });
};
