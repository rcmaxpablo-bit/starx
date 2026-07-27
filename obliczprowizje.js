const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require("discord.js");
const { upsertPanel } = require("./panelManager");

module.exports = (client) => {
  const CHANNEL_ID = "1499568863602540645";
  const SEPARATOR = "-----------------------";
  const EPHEMERAL = 64;

  const EMOJI = {
    blik: "<:blik:1499784231608389742>",
    paypal: "<:paypal:1499784258091483236>",
    crypto: "<:crypto:1499784635201224724>",
    ltc: "<:ltc:1499784285211726014>",
    psc: "<:MYPSC:1519440223140970636>",
    skrill: "<:SKRILL:1519440276492521472>",
    money: "<a:money:1501685438103031920>",
    arrow: "<a:Arrow_White:1508094625984811038>"
  };

  const rates = {
    BLIK_PAYPAL: 2,
    BLIK_CRYPTO: 8,
    BLIK_SKRILL: 2,

    KODBLIK_PAYPAL: 6,
    KODBLIK_CRYPTO: 11,
    KODBLIK_SKRILL: 6,

    PSC_BLIK: 11,
    PSC_KODBLIK: 11,
    PSC_PAYPAL: 11,
    PSC_CRYPTO: 13,
    PSC_SKRILL: 11,

    PAYPAL_BLIK: 9,
    PAYPAL_CRYPTO: 9,
    PAYPAL_SKRILL: 9,

    CRYPTO_BLIK: 4,
    CRYPTO_KODBLIK: 4,
    CRYPTO_PAYPAL: 4,
    CRYPTO_CRYPTO: 4,
    CRYPTO_SKRILL: 4,

    SKRILL_BLIK: 9,
    SKRILL_KODBLIK: 9,
    SKRILL_PAYPAL: 9,
    SKRILL_CRYPTO: 9
  };

  const AVAILABLE_METHODS = Object.freeze([
    "BLIK",
    "KODBLIK",
    "PSC",
    "PAYPAL",
    "CRYPTO",
    "SKRILL"
  ]);

  const VALID_METHODS = new Set(AVAILABLE_METHODS);

  function normalizeMethod(value) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[ _-]+/g, "");

    if (["LTC", "BTC", "ETH", "SOL", "USDT"].includes(normalized)) {
      return "CRYPTO";
    }

    return VALID_METHODS.has(normalized) ? normalized : null;
  }

  function methodName(method) {
    return method === "KODBLIK" ? "KOD BLIK" : method;
  }

  function methodEmoji(method) {
    if (method === "BLIK" || method === "KODBLIK") return EMOJI.blik;
    if (method === "PAYPAL") return EMOJI.paypal;
    if (method === "CRYPTO") return EMOJI.crypto;
    if (method === "PSC") return EMOJI.psc;
    if (method === "SKRILL") return EMOJI.skrill;
    return EMOJI.money;
  }

  function componentEmoji(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^<(a?):([A-Za-z0-9_]+):(\d{17,20})>$/);

    if (match) {
      return {
        animated: match[1] === "a",
        name: match[2],
        id: match[3]
      };
    }

    return { name: raw || "💱" };
  }

  function createMethodOptions() {
    return AVAILABLE_METHODS.map(method => ({
      label: methodName(method),
      value: method,
      emoji: componentEmoji(methodEmoji(method))
    }));
  }

  function createCalcModal(type) {
    const amountLabel = new LabelBuilder()
      .setLabel("JAKA KWOTA")
      .setDescription(type === "otrzymam"
        ? "Podaj kwotę, od której ma zostać odjęta prowizja"
        : "Podaj kwotę, którą chcesz otrzymać")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("amount")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Np. 250")
          .setRequired(true)
      );

    const fromLabel = new LabelBuilder()
      .setLabel("Z CZEGO")
      .setDescription("Wybierz metodę źródłową")
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("from")
          .setPlaceholder("Wybierz metodę źródłową")
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(true)
          .addOptions(createMethodOptions())
      );

    const toLabel = new LabelBuilder()
      .setLabel("NA CO")
      .setDescription("Wybierz metodę docelową")
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("to")
          .setPlaceholder("Wybierz metodę docelową")
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(true)
          .addOptions(createMethodOptions())
      );

    return new ModalBuilder()
      .setCustomId(`calc_modal_${type}`)
      .setTitle("Kalkulator prowizji")
      .addLabelComponents(amountLabel, fromLabel, toLabel);
  }

  function calculateResult(type, amount, percent) {
    const rate = percent / 100;

    if (type === "otrzymam") {
      const fee = Math.max(amount * rate, 3);
      const result = amount - fee;
      if (result <= 0) return null;
      return { fee, result };
    }

    if (type === "wplace") {
      // Szukamy kwoty brutto, z której po odjęciu prowizji zostanie dokładnie X.
      const minimumFeeGross = amount + 3;
      if (minimumFeeGross * rate <= 3) {
        return { fee: 3, result: minimumFeeGross };
      }

      const gross = amount / (1 - rate);
      return { fee: gross - amount, result: gross };
    }

    return null;
  }

  async function sendPanel() {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased?.()) {
      console.error(`KALKULATOR PROWIZJI: nie znaleziono kanału ${CHANNEL_ID}.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#1b2dff")
      .setTitle("StarX Exchange x KALKULATOR PROWIZJI")
      .setDescription([
        `${EMOJI.arrow} Jeżeli chcesz obliczyć prowizję swojej wymiany, wybierz opcję poniżej.`,
        "",
        SEPARATOR,
        "",
        `${EMOJI.arrow} Minimalna prowizja wynosi: **3 PLN**`
      ].join("\n"))
      .setFooter({ text: "© 2026 StarX Exchange" });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("calc_type")
      .setPlaceholder("Wybierz sposób obliczenia")
      .addOptions([
        {
          label: "Jaką kwotę otrzymam?",
          value: "otrzymam",
          emoji: { id: "1501685438103031920", name: "money", animated: true }
        },
        {
          label: "Ile muszę wpłacić, aby dostać X?",
          value: "wplace",
          emoji: { id: "1508094625984811038", name: "Arrow_White", animated: true }
        }
      ]);

    await upsertPanel(channel, {
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    }, { customId: "calc_type" });

    console.log("Kalkulator prowizji zaktualizowany");
  }

  if (client.isReady()) {
    sendPanel().catch(error => {
      console.error("KALKULATOR PROWIZJI PANEL ERROR:", error?.stack || error);
    });
  } else {
    client.once(Events.ClientReady, () => {
      sendPanel().catch(error => {
        console.error("KALKULATOR PROWIZJI PANEL ERROR:", error?.stack || error);
      });
    });
  }

  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === "calc_type") {
        const type = interaction.values[0];
        if (!["otrzymam", "wplace"].includes(type)) return;
        return interaction.showModal(createCalcModal(type));
      }

      if (!interaction.isModalSubmit() || !interaction.customId.startsWith("calc_modal_")) {
        return;
      }

      const type = interaction.customId.replace("calc_modal_", "");
      const amount = Number(
        interaction.fields
          .getTextInputValue("amount")
          .trim()
          .replace(",", ".")
      );
      const from = normalizeMethod(
        interaction.fields.getStringSelectValues("from")[0]
      );
      const to = normalizeMethod(
        interaction.fields.getStringSelectValues("to")[0]
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        return interaction.reply({
          content: "Podaj poprawną kwotę większą od zera.",
          flags: EPHEMERAL
        });
      }

      if (!from || !to) {
        return interaction.reply({
          content: "Podaj poprawne metody, np. BLIK, KOD BLIK, PSC, PAYPAL, CRYPTO lub SKRILL.",
          flags: EPHEMERAL
        });
      }

      const percent = rates[`${from}_${to}`];
      if (!Number.isFinite(percent)) {
        return interaction.reply({
          content: "Ta para wymiany nie jest obecnie obsługiwana.",
          flags: EPHEMERAL
        });
      }

      const calculation = calculateResult(type, amount, percent);
      if (!calculation) {
        return interaction.reply({
          content: "Kwota jest zbyt niska względem minimalnej prowizji 3 PLN.",
          flags: EPHEMERAL
        });
      }

      const resultLabel = type === "otrzymam"
        ? "Kwota po prowizji"
        : "Kwota do wpłaty";

      const embed = new EmbedBuilder()
        .setColor("#1b2dff")
        .setTitle("StarX Exchange x WYNIK")
        .setDescription([
          `${methodEmoji(from)} **Z:** ${methodName(from)}`,
          "",
          `${methodEmoji(to)} **Na:** ${methodName(to)}`,
          "",
          `${EMOJI.money} **Prowizja:** ${percent}%`,
          `${EMOJI.arrow} **Pobrana prowizja:** ${calculation.fee.toFixed(2)} PLN`,
          `${EMOJI.arrow} **Minimalna prowizja:** 3 PLN`,
          "",
          SEPARATOR,
          "",
          `${EMOJI.money} **${resultLabel}:** \`${calculation.result.toFixed(2)} PLN\``
        ].join("\n"))
        .setFooter({ text: "© 2026 StarX Exchange x Kalkulator" });

      return interaction.reply({
        embeds: [embed],
        flags: EPHEMERAL
      });
    } catch (error) {
      console.error("KALKULATOR PROWIZJI ERROR:", error?.stack || error);
      const payload = {
        content: "Wystąpił błąd podczas obliczania prowizji. Spróbuj ponownie.",
        flags: EPHEMERAL
      };

      if (interaction.deferred) {
        await interaction.editReply(payload).catch(() => {});
      } else if (interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else if (interaction.isRepliable()) {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });
};
