const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} = require("discord.js");

module.exports = async (client) => {
  const CHANNEL_ID = "1499513009188376767";
  const SEPARATOR = "-----------------------";

  const EMOJI = {
    blik: "<:blik:1499784231608389742>",
    paypal: "<:paypal:1499784258091483236>",
    crypto: "<:crypto:1499784635201224724>",
    ltc: "<:ltc:1499784285211726014>",
    psc: "<:MYPSC:1519440223140970636>",
    skrill: "<:SKRILL:1519440276492521472>",
    money: "<a:money:1501685438103031920>",
    arrow: "<a:Arrow_White:1508094625984811038>",
    box: "<:box:1500243849535033577>"
  };

  const rateDescriptions = {
    BLIK: [
      `${EMOJI.blik} **BLIK** -> ${EMOJI.paypal} **PAYPAL** - Prowizja wynosi: **2%**`,
      `${EMOJI.blik} **BLIK** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **8%**`,
      `${EMOJI.blik} **BLIK** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **8%**`,
      `${EMOJI.blik} **BLIK** -> ${EMOJI.skrill} **SKRILL** - Prowizja wynosi: **2%**`
    ],
    KODBLIK: [
      `${EMOJI.blik} **KOD BLIK** -> ${EMOJI.paypal} **PAYPAL** - Prowizja wynosi: **6%**`,
      `${EMOJI.blik} **KOD BLIK** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **11%**`,
      `${EMOJI.blik} **KOD BLIK** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **11%**`,
      `${EMOJI.blik} **KOD BLIK** -> ${EMOJI.skrill} **SKRILL** - Prowizja wynosi: **6%**`
    ],
    PSC: [
      `${EMOJI.psc} **PSC** -> ${EMOJI.blik} **BLIK** - Prowizja wynosi: **11%**`,
      `${EMOJI.psc} **PSC** -> ${EMOJI.blik} **KOD BLIK** - Prowizja wynosi: **11%**`,
      `${EMOJI.psc} **PSC** -> ${EMOJI.paypal} **PAYPAL** - Prowizja wynosi: **11%**`,
      `${EMOJI.psc} **PSC** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **13%**`,
      `${EMOJI.psc} **PSC** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **13%**`,
      `${EMOJI.psc} **PSC** -> ${EMOJI.skrill} **SKRILL** - Prowizja wynosi: **11%**`
    ],
    PAYPAL: [
      `${EMOJI.paypal} **PAYPAL** -> ${EMOJI.blik} **BLIK** - Prowizja wynosi: **9%**`,
      `${EMOJI.paypal} **PAYPAL** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **9%**`,
      `${EMOJI.paypal} **PAYPAL** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **9%**`,
      `${EMOJI.paypal} **PAYPAL** -> ${EMOJI.skrill} **SKRILL** - Prowizja wynosi: **9%**`
    ],
    CRYPTO: [
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.blik} **BLIK** - Prowizja wynosi: **4%**`,
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.blik} **KOD BLIK** - Prowizja wynosi: **4%**`,
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.paypal} **PAYPAL** - Prowizja wynosi: **4%**`,
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **4%**`,
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **4%**`,
      `${EMOJI.crypto} **CRYPTO** -> ${EMOJI.skrill} **SKRILL** - Prowizja wynosi: **4%**`
    ],
    SKRILL: [
      `${EMOJI.skrill} **SKRILL** -> ${EMOJI.blik} **BLIK** - Prowizja wynosi: **9%**`,
      `${EMOJI.skrill} **SKRILL** -> ${EMOJI.blik} **KOD BLIK** - Prowizja wynosi: **9%**`,
      `${EMOJI.skrill} **SKRILL** -> ${EMOJI.paypal} **PAYPAL** - Prowizja wynosi: **9%**`,
      `${EMOJI.skrill} **SKRILL** -> ${EMOJI.crypto} **CRYPTO** - Prowizja wynosi: **9%**`,
      `${EMOJI.skrill} **SKRILL** -> ${EMOJI.ltc} **LTC** - Prowizja wynosi: **9%**`
    ]
  };

  function menuOptions() {
    return [
      { label: "BLIK", value: "BLIK", emoji: { id: "1499784231608389742", name: "blik" } },
      { label: "KOD BLIK", value: "KODBLIK", emoji: { id: "1499784231608389742", name: "blik" } },
      { label: "PSC", value: "PSC", emoji: { id: "1519440223140970636", name: "MYPSC" } },
      { label: "PAYPAL", value: "PAYPAL", emoji: { id: "1499784258091483236", name: "paypal" } },
      { label: "CRYPTO", value: "CRYPTO", emoji: { id: "1499784635201224724", name: "crypto" } },
      { label: "SKRILL", value: "SKRILL", emoji: { id: "1519440276492521472", name: "SKRILL" } }
    ];
  }

  async function sendPanel() {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor("#1b2dff")
      .setTitle("StarX Exchange >> PROWIZJE")
      .setDescription([
        `${EMOJI.money} Wybierz metode platnosci z menu ponizej.`,
        "",
        SEPARATOR,
        "",
        `${EMOJI.arrow} Minimalna prowizja wynosi: **3 PLN**`,
        "",
        SEPARATOR,
        "",
        `${EMOJI.box} Szybkie i przejrzyste prowizje.`
      ].join("\n"))
      .setFooter({ text: "© 2026 StarX Exchange" });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("show_rates")
      .setPlaceholder("Wybierz metode")
      .addOptions(menuOptions());

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });

    console.log("Panel prowizji wyslany");
  }

  if (client.isReady()) {
    sendPanel();
  } else {
    client.once(Events.ClientReady, sendPanel);
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "show_rates") return;

    const type = interaction.values[0];
    const description = [
      ...(rateDescriptions[type] || []),
      "",
      SEPARATOR,
      "",
      `${EMOJI.arrow} Minimalna prowizja wynosi: **3 PLN**`
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor("#1b2dff")
      .setTitle(`StarX Exchange >> ${type}`)
      .setDescription(description)
      .setFooter({ text: "© 2026 StarX Exchange" });

    return interaction.reply({
      embeds: [embed],
      flags: 64
    });
  });
};

