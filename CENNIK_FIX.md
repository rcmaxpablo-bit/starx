const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} = require("discord.js");
const { upsertPanel } = require("./panelManager");

const CHANNEL_ID = "1499902366843932763";
const MENU_ID = "starx_cennik";

// Starsze identyfikatory są obsługiwane, żeby kliknięcia działały również
// na panelach wysłanych przed aktualizacją bota.
const LEGACY_MENU_IDS = new Set([
  MENU_ID,
  "cennik_select",
  "cennik_menu",
  "select_cennik",
  "price_list_select",
  "starx_price_list"
]);

const BLUE = "#1b2dff";
const BANNER_URL =
  "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand";

const EMOJI = {
  spotify: "<:Spotify:1500238701718933627>",
  netflix: "<:Netflix:1500238788306403398>",
  ytpremium: "<:ytpremium:1500239415937859605>",
  hbomax: "<:HBOmax:1500239251143524464>",
  nitro: "<a:nitro:1501684762601848963>",
  crunchyroll: "<:CRUNCHYROLL:1501686424158605463>",
  disney: "<:DISNEY:1501686870025699449>",
  money: "<a:m_:1501685438103031920>",
  pin: "<:PIN:1501697389050986546>",
  zap: "<:PIORUN:1501697151737139350>",
  lock: "<:ZAMKNIETE:1501697222901895258>",
  primevideo: "<:primevideo:1502001410311716984>",
  chatgpt: "<:521605chatgpt:1502001751019094097>",
  capcut: "<:Capcut:1502002116405887039>",
  nordvpn: "<:NORDVPN:1501999409343369400>",
  mullvad: "<:mullvad:1501999834159255712>",
  tunnelbear: "<:TUNNELBEARVPN:1502000450009042984>",
  cda: "<:CDA:1508077411873325076>"
};

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(BLUE)
    .setTitle("🌟 StarX Exchange » CENNIK")
    .setDescription([
      `${EMOJI.pin} Wybierz kategorię z menu poniżej.`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `${EMOJI.zap} Szybka realizacja`,
      `${EMOJI.lock} Bezpieczne transakcje`,
      `${EMOJI.money} Najlepsze ceny`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━"
    ].join("\n"))
    .setImage(BANNER_URL)
    .setFooter({ text: "© 2026 StarX Exchange" });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(MENU_ID)
    .setPlaceholder("📦 Wybierz kategorię...")
    .addOptions([
      {
        label: "NITRO",
        value: "nitro",
        emoji: { id: "1501684762601848963", animated: true }
      },
      {
        label: "STREAMING",
        value: "streaming",
        emoji: { id: "1500238788306403398" }
      },
      {
        label: "VPN",
        value: "vpn",
        emoji: { id: "1501999409343369400" }
      }
    ]);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

function normalizeCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["nitro", "discord_nitro", "discord-nitro"].includes(normalized)) {
    return "nitro";
  }

  if (["streaming", "stream", "konta", "accounts"].includes(normalized)) {
    return "streaming";
  }

  if (["vpn", "vpns"].includes(normalized)) {
    return "vpn";
  }

  return null;
}

function categoryEmbed(category) {
  if (category === "nitro") {
    return new EmbedBuilder()
      .setColor(BLUE)
      .setTitle(`${EMOJI.nitro} StarX Exchange » NITRO`)
      .setDescription([
        `${EMOJI.nitro} **Nitro Boost (28 dni • Full Warranty)**`,
        `${EMOJI.money} \`20 zł\``
      ].join("\n"))
      .setFooter({ text: "StarX Exchange • Najlepsze ceny" });
  }

  if (category === "streaming") {
    return new EmbedBuilder()
      .setColor(BLUE)
      .setTitle(`${EMOJI.netflix} StarX Exchange » STREAMING`)
      .setDescription([
        `${EMOJI.spotify} **Spotify Premium LIFETIME [KEY]**`,
        `${EMOJI.money} \`30 zł\``,
        "",
        `${EMOJI.spotify} **Spotify Premium FA [LIFETIME]**`,
        `${EMOJI.money} \`20 zł\``,
        "",
        `${EMOJI.ytpremium} **YT Premium FA [LIFETIME]**`,
        `${EMOJI.money} \`20 zł\``,
        "",
        `${EMOJI.primevideo} **Prime Video 1 Month**`,
        `${EMOJI.money} \`20 zł\``,
        "",
        `${EMOJI.chatgpt} **ChatGPT Plus FA 1 Month**`,
        `${EMOJI.money} \`40 zł\``,
        "",
        `${EMOJI.capcut} **CapCut Pro FA [LIFETIME]**`,
        `${EMOJI.money} \`20 zł\``,
        "",
        `${EMOJI.netflix} **Netflix Lifetime**`,
        `${EMOJI.money} \`20 zł\``,
        "",
        `${EMOJI.hbomax} **Max (HBO) Lifetime**`,
        `${EMOJI.money} \`10 zł\``,
        "",
        `${EMOJI.disney} **Disney+ Lifetime**`,
        `${EMOJI.money} \`10 zł\``,
        "",
        `${EMOJI.crunchyroll} **Crunchyroll Fan Lifetime**`,
        `${EMOJI.money} \`10 zł\``,
        "",
        `${EMOJI.cda} **CDA Premium Lifetime**`,
        `${EMOJI.money} \`10 zł\``
      ].join("\n"))
      .setFooter({ text: "StarX Exchange • Najniższe ceny" });
  }

  if (category === "vpn") {
    return new EmbedBuilder()
      .setColor(BLUE)
      .setTitle(`${EMOJI.nordvpn} StarX Exchange » VPN`)
      .setDescription([
        `${EMOJI.nordvpn} **NordVPN (Private) [LIFETIME]**`,
        `${EMOJI.money} \`15 zł\``,
        "",
        `${EMOJI.mullvad} **Mullvad VPN [LIFETIME]**`,
        `${EMOJI.money} \`40 zł\``,
        "",
        `${EMOJI.tunnelbear} **Tunnel Bear [VPN]**`,
        `${EMOJI.money} \`20 zł\``
      ].join("\n"))
      .setFooter({ text: "StarX Exchange • VPN Store" });
  }

  return null;
}

function hasCennikTitle(interaction) {
  return interaction.message?.embeds?.some(embed =>
    String(embed?.title || "").toUpperCase().includes("CENNIK")
  );
}

function isCennikInteraction(interaction) {
  if (!interaction.isStringSelectMenu?.()) return false;

  const customId = String(interaction.customId || "");

  return (
    LEGACY_MENU_IDS.has(customId) ||
    (
      interaction.channelId === CHANNEL_ID &&
      hasCennikTitle(interaction)
    )
  );
}

async function acknowledge(interaction) {
  if (interaction.deferred || interaction.replied) return;

  // Liczba 64 oznacza odpowiedź widoczną tylko dla użytkownika.
  // Jest zgodna także ze starszymi wydaniami discord.js v14.
  await interaction.deferReply({ flags: 64 });
}

async function sendInteractionResult(interaction, payload) {
  if (interaction.deferred) {
    return interaction.editReply(payload);
  }

  if (interaction.replied) {
    return interaction.followUp({ ...payload, flags: 64 });
  }

  return interaction.reply({ ...payload, flags: 64 });
}

module.exports = client => {
  // Zapobiega podwójnemu załadowaniu listenera przy przypadkowym imporcie.
  if (client.__starxCennikLoaded) return;
  client.__starxCennikLoaded = true;

  client.once(Events.ClientReady, async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID, { force: true });
      if (!channel) {
        console.error(`❌ Cennik: nie znaleziono kanału ${CHANNEL_ID}.`);
        return;
      }

      const message = await upsertPanel(
        channel,
        panelPayload(),
        {
          panelKey: "starx-cennik",
          customId: MENU_ID,
          customIds: [...LEGACY_MENU_IDS],
          embedTitleIncludes: "CENNIK",
          maxScan: 1500
        }
      );

      console.log(`✅ Cennik zaktualizowany: ${message.id}`);
    } catch (error) {
      console.error("❌ Cennik panel error:", error?.stack || error);
    }
  });

  const handleCennikInteraction = async interaction => {
    if (!isCennikInteraction(interaction)) return;

    try {
      // Potwierdzenie następuje przed budowaniem embeda i odczytem danych.
      await acknowledge(interaction);

      const category = normalizeCategory(interaction.values?.[0]);
      const embed = categoryEmbed(category);

      if (!embed) {
        return sendInteractionResult(interaction, {
          content: "❌ Nie rozpoznano wybranej kategorii. Odśwież panel i spróbuj ponownie.",
          embeds: []
        });
      }

      return sendInteractionResult(interaction, {
        content: null,
        embeds: [embed]
      });
    } catch (error) {
      console.error("❌ Menu cennika error:", error?.stack || error);

      const payload = {
        content: "❌ Nie udało się wyświetlić cennika. Spróbuj ponownie za chwilę.",
        embeds: []
      };

      try {
        return await sendInteractionResult(interaction, payload);
      } catch (responseError) {
        console.error(
          "❌ Menu cennika response error:",
          responseError?.stack || responseError
        );
      }
    }
  };

  // Umieszczamy obsługę przed innymi modułami. Chroni to menu przed
  // synchronicznym błędem w obcym listenerze interactionCreate.
  if (typeof client.prependListener === "function") {
    client.prependListener(Events.InteractionCreate, handleCennikInteraction);
  } else {
    client.on(Events.InteractionCreate, handleCennikInteraction);
  }
};
