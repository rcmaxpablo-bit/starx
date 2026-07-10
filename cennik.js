const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} = require("discord.js");

module.exports = (client) => {

  const CHANNEL_ID = "1499902366843932763";

  // ========================
  // EMOJI
  // ========================
  const EMOJI_SPOTIFY = "<:Spotify:1500238701718933627>";
  const EMOJI_NETFLIX = "<:Netflix:1500238788306403398>";
  const EMOJI_YT = "<:ytpremium:1500239415937859605>";
  const EMOJI_HBO = "<:HBOmax:1500239251143524464>";

  const EMOJI_NITRO = "<a:nitro:1501684762601848963>";
  const EMOJI_CRUNCHY = "<:crunchyroll:1501686424158605463>";
  const EMOJI_DISNEY = "<:disney:1501686870025699449>";
  const EMOJI_MONEY = "<a:money:1501685438103031920>";

  const EMOJI_PIN = "<:pin:1501697389050986546>";
  const EMOJI_ZAP = "<:zap:1501697151737139350>";
  const EMOJI_LOCK = "<:lock:1501697222901895258>";

  const EMOJI_PRIME = "<:primevideo:1502001410311716984>";
  const EMOJI_CHATGPT = "<:chatgpt:1502001751019094097>";
  const EMOJI_CAPCUT = "<:capcut:1502002116405887039>";

  const EMOJI_NORD = "<:nordvpn:1501999409343369400>";
  const EMOJI_MULLVAD = "<:mullvad:1501999834159255712>";
  const EMOJI_TUNNEL = "<:tunnelbear:1502000450009042984>";

  const EMOJI_CDA = "<:cda:1508077411873325076>";

  // ========================
  // PANEL
  // ========================
  client.once(Events.ClientReady, async () => {

    try {

      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor("#1b2dff")
        .setTitle("🌟 StarX Exchange » CENNIK")
        .setDescription(
`${EMOJI_PIN} Wybierz kategorię z menu poniżej.

━━━━━━━━━━━━━━━━━━━━━━━

${EMOJI_ZAP} Szybka realizacja  
${EMOJI_LOCK} Bezpieczne transakcje  
${EMOJI_MONEY} Najlepsze ceny

━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setImage("https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand")
        .setFooter({ text: "© 2026 StarX Exchange" });

      const menu = new StringSelectMenuBuilder()
        .setCustomId("starx_cennik")
        .setPlaceholder("📦 Wybierz kategorię...")
        .addOptions([
          {
            label: "NITRO",
            value: "nitro",
            emoji: { id: "1501684762601848963", name: "nitro" }
          },
          {
            label: "STREAMING",
            value: "streaming",
            emoji: { id: "1500238788306403398", name: "Netflix" }
          },
          {
            label: "VPN",
            value: "vpn",
            emoji: { id: "1501999409343369400", name: "nordvpn" }
          }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      console.log("✅ Cennik wysłany");

    } catch (err) {
      console.log("❌ Cennik error:", err);
    }
  });

  // ========================
  // MENU
  // ========================
  client.on(Events.InteractionCreate, async (interaction) => {

    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "starx_cennik") return;

    try {

      // =====================
      // NITRO
      // =====================
      if (interaction.values[0] === "nitro") {

        const embed = new EmbedBuilder()
          .setColor("#1b2dff")
          .setTitle(`${EMOJI_NITRO} StarX Exchange » NITRO`)
          .setDescription(
`${EMOJI_NITRO} **Nitro Boost (28 dni • Full Warranty)**  
${EMOJI_MONEY} \`20 zł\``
          )
          .setFooter({ text: "StarX Exchange • Najlepsze ceny" });

        return interaction.reply({
          embeds: [embed],
          flags: 64
        });
      }

      // =====================
      // STREAMING
      // =====================
      if (interaction.values[0] === "streaming") {

        const embed = new EmbedBuilder()
          .setColor("#1b2dff")
          .setTitle(`${EMOJI_NETFLIX} StarX Exchange » STREAMING`)
          .setDescription(
`${EMOJI_SPOTIFY} **Spotify Premium LIFETIME [KEY]**  
${EMOJI_MONEY} \`30 zł\`

${EMOJI_SPOTIFY} **Spotify Premium FA [LIFETIME]**  
${EMOJI_MONEY} \`20 zł\`

${EMOJI_YT} **YT Premium FA [LIFETIME]**  
${EMOJI_MONEY} \`20 zł\`

${EMOJI_PRIME} **Prime Video 1 Month**  
${EMOJI_MONEY} \`20 zł\`

${EMOJI_CHATGPT} **ChatGPT Plus FA 1 Month**  
${EMOJI_MONEY} \`40 zł\`

${EMOJI_CAPCUT} **CapCut Pro FA [LIFETIME]**  
${EMOJI_MONEY} \`20 zł\`

${EMOJI_NETFLIX} **Netflix Lifetime**  
${EMOJI_MONEY} \`20 zł\`

${EMOJI_HBO} **Max (HBO) Lifetime**  
${EMOJI_MONEY} \`10 zł\`

${EMOJI_DISNEY} **Disney+ Lifetime**  
${EMOJI_MONEY} \`10 zł\`

${EMOJI_CRUNCHY} **Crunchyroll Fan Lifetime**  
${EMOJI_MONEY} \`10 zł\`

${EMOJI_CDA} **CDA Premium Lifetime**  
${EMOJI_MONEY} \`10 zł\``
          )
          .setFooter({ text: "StarX Exchange • Najniższe ceny" });

        return interaction.reply({
          embeds: [embed],
          flags: 64
        });
      }

      // =====================
      // VPN
      // =====================
      if (interaction.values[0] === "vpn") {

        const embed = new EmbedBuilder()
          .setColor("#1b2dff")
          .setTitle(`${EMOJI_NORD} StarX Exchange » VPN`)
          .setDescription(
`${EMOJI_NORD} **NordVPN (Private) [LIFETIME]**  
${EMOJI_MONEY} \`15 zł\`

${EMOJI_MULLVAD} **Mullvad VPN [LIFETIME]**  
${EMOJI_MONEY} \`40 zł\`

${EMOJI_TUNNEL} **Tunnel Bear [VPN]**  
${EMOJI_MONEY} \`20 zł\``
          )
          .setFooter({ text: "StarX Exchange • VPN Store" });

        return interaction.reply({
          embeds: [embed],
          flags: 64
        });
      }

    } catch (err) {
      console.log("❌ Menu error:", err);
    }
  });
};
