const {
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  Events,
  ChannelType,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");
const { upsertPanel } = require("./panelManager");
const store = require("./dataStore");

module.exports = (client) => {

  // =========================================
  // CONFIG
  // =========================================
  const PANEL_CHANNEL_ID = "1509429804770791494";
  const REALIZATOR_ROLE_ID = "1500930428993933373";
  const CLIENT_ROLE_ID = "1499572498604363918";
  // Kanał, na którym klient ma wystawić legit checka / dostać ping
  const LEGIT_CHECK_CHANNEL_ID = "1500893110048133253";
  // Kanał z reakcjami / stary kanał legit-check, zostawiony jako fallback do pinga
  const REACTION_LEGIT_CHANNEL_ID = "1499519884860854505";
  const OPINIE_CHANNEL_ID = "1499519935657935049";
  const CATEGORY_CLAIMED_ID = "1510410009853431868";
  const CATEGORY_UNCLAIMED_ID = "1510410325038727311";


  // UZUPEŁNIJ SWOJE DANE PŁATNOŚCI
  const PAYMENT = {
    blik: {
      number: "780 130 528",
      receiver: "Odbiorca kolega",
      title: "oddaje (sam wybierz do adekwatnego do kwoty)"
    }
  };

  // Podmień linki na swoje bannery z obrazków jak na screenach
  const BANNER_TICKET_URL = process.env.BANNER_TICKET_URL || "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand";
  const BANNER_LEGIT_URL = process.env.BANNER_LEGIT_URL || "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand";

  // =========================================
  // COLOR
  // =========================================
  const EMBED_COLOR = "#1b2dff";

  // =========================================
  // TEMP DATA
  // =========================================
  const exchangeData = new Map();
  const claimedTickets = new Map();
  const userStats = new Map();
  const pendingLegitTickets = new Map(); // clientId -> ticketChannelId

  function getUserStats(userId) {
    if (!userStats.has(userId)) userStats.set(userId, { exchanges: 8, total: 369 });
    return userStats.get(userId);
  }

  function addUserExchange(userId, amount) {
    const stats = getUserStats(userId);
    stats.exchanges += 1;
    stats.total += Number(amount) || 0;
    userStats.set(userId, stats);
    return stats;
  }

  function formatMoney(value) {
    return `${Number(value || 0).toFixed(2)} PLN`;
  }

  function formatCurrency(value, currency = "PLN") {
    return `${Number(value || 0).toFixed(2)} ${String(currency || "PLN").toUpperCase()}`;
  }

  function saveCustomerTransaction(interaction, { clientId, amount, type, description, currency = "PLN" }) {
    if (!clientId) return null;
    return store.recordTransaction({
      userId: clientId,
      amount,
      type,
      description,
      currency,
      channelId: interaction.channel.id,
      moderatorId: interaction.user.id
    });
  }

  function cleanTicketName(name) {
    return String(name || "ticket")
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9ąćęłńóśźż-]/gi, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 85) || "ticket";
  }

  function unlockTicketName(baseName) {
    const clean = cleanTicketName(baseName).replace(/^lock-/, "").replace(/^unlock-/, "");
    return `unlock-${clean}`;
  }

  function lockTicketName(currentName) {
    const clean = cleanTicketName(currentName).replace(/^unlock-/, "").replace(/^lock-/, "");
    return `lock-${clean}`;
  }

  async function giveClientRoleById(guild, userId) {
    if (!guild || !userId) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    await member.roles.add(CLIENT_ROLE_ID).catch(() => {});
  }

  async function updateLegitCounterChannel(guild, count) {
    if (!guild) return;
    const settings = store.read("settings");
    const prefix = "│✅・legit-check→";
    const channelId = "1500893110048133253";
    const channel = await guild.channels.fetch(channelId).catch(() => null);

    settings.legitCounterChannelId = channelId;
    settings.legitCounterChannelPrefix = prefix;
    store.write("settings", settings);

    if (!channel?.setName) {
      console.log("LEGIT COUNTER: nie znaleziono kanału 1500893110048133253.");
      return;
    }

    const newName = `${prefix}${count}`;
    if (channel.name !== newName) {
      await channel.setName(newName).catch(err =>
        console.log("LEGIT COUNTER RENAME ERROR:", err.message)
      );
    }
  }

  // Liczy wszystkie istniejące wiadomości +rep z historii kanału LC.
  // Dzięki temu licznik działa również dla wiadomości wysłanych przed aktualizacją bota.
  async function syncLegitCounterFromHistory(guild) {
    if (!guild) return 0;

    const legitChannel = await guild.channels.fetch(LEGIT_CHECK_CHANNEL_ID).catch(() => null);
    if (!legitChannel?.messages?.fetch) {
      console.log("LEGIT HISTORY SYNC: nie znaleziono kanału LC lub brak dostępu do historii.");
      return Number(store.read("settings").legitCount || 0);
    }

    let before;
    let total = 0;

    while (true) {
      const batch = await legitChannel.messages.fetch({
        limit: 100,
        ...(before ? { before } : {})
      }).catch(err => {
        console.log("LEGIT HISTORY FETCH ERROR:", err.message);
        return null;
      });

      if (!batch || batch.size === 0) break;

      for (const msg of batch.values()) {
        if (msg.author?.bot) continue;
        if (msg.content?.trim().toLowerCase().startsWith("+rep")) total += 1;
      }

      before = batch.last().id;
      if (batch.size < 100) break;
    }

    store.setLegitCount(total);
    await updateLegitCounterChannel(guild, total);
    console.log(`✅ Licznik LC zsynchronizowany z historią: ${total}`);
    return total;
  }

  function ticketButtons(isClaimed = false) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setEmoji({ id: "1499784378992295956", animated: true })
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(isClaimed ? "unclaim_ticket" : "claim_ticket")
        .setEmoji(isClaimed ? { id: "1510596058470809690" } : { id: "1501697222901895258" })
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("send_legit_check")
        .setEmoji({ id: "1499784353012514917", animated: true })
        .setStyle(ButtonStyle.Success)
    );
  }


  function createPurchaseLegitModal() {
    return new ModalBuilder()
      .setCustomId("purchase_legit_modal")
      .setTitle("Legit check zakupu")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("purchase_item")
            .setLabel("Co kupił klient?")
            .setPlaceholder("Np. YT Premium FA [LIFETIME]")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("purchase_amount")
            .setLabel("Kwota")
            .setPlaceholder("Np. 24")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("purchase_method")
            .setLabel("Metoda płatności")
            .setPlaceholder("Np. PSC / BLIK / PAYPAL / LTC")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
  }

  function parseUserId(value) {
    const match = String(value || "").trim().match(/\d{17,20}/);
    return match ? match[0] : null;
  }

  function createMiddlemanModal() {
    return new ModalBuilder()
      .setCustomId("middleman_modal")
      .setTitle("Middleman")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("middleman_user_id")
            .setLabel("ID osoby do dodania")
            .setPlaceholder("Np. 123456789012345678")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
  }

  function createMiddlemanLegitModal() {
    return new ModalBuilder()
      .setCustomId("middleman_legit_modal")
      .setTitle("Legit check middleman")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("middleman_legit_amount")
            .setLabel("Kwota")
            .setPlaceholder("Np. 100")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
  }

  // =========================================
  // EMOJI
  // =========================================
  const EMOJI = {

    // =========================
    // TICKETY / SYSTEM
    // =========================
    ticket: "<:TICKET:1501697124734206032>",
    pin: "<:PIN:1501697389050986546>",
    zap: "<:PIORUN:1501697151737139350>",
    lock: "<:ZAMKNIETE:1501697222901895258>",
    unlock: "<:OTWARTE:1510596058470809690>",
    warning: "<:PILNE:1501693444030992395>",
    support: "<:WSPARCIE:1500243961124618381>",
    admin: "<:ADM:1501989271077388500>",
    list: "<:LIST:1501693215328440370>",
    clock: "<:CZAS:1502030015943151868>",

    // =========================
    // MONEY / ANIMOWANE
    // =========================
    money: "<a:m_:1501685438103031920>",
    arrow: "<a:Arrow_White:1508094625984811038>",
    nitro: "<a:nitro:1501684762601848963>",

    // =========================
    // PAYMENT METHODS
    // =========================
    blik: "<:blik:1499784231608389742>",
    kodblik: "<:blik:1499784231608389742>",
    paypal: "<:paypal:1499784258091483236>",
    crypto: "<:crypto:1499784635201224724>",
    ltc: "<:ltc:1499784285211726014>",
    psc: "<:MYPSC:1519440223140970636>",
    skrill: "<:SKRILL:1519440276492521472>",
    vinted: "🟦",
    zen: "⚪",

    // =========================
    // SHOP / STREAMING
    // =========================
    spotify: "<:Spotify:1500238701718933627>",
    netflix: "<:Netflix:1500238788306403398>",
    ytpremium: "<:ytpremium:1500239415937859605>",
    hbomax: "<:HBOmax:1500239251143524464>",
    crunchyroll: "<:CRUNCHYROLL:1501686424158605463>",
    disney: "<:DISNEY:1501686870025699449>",
    primevideo: "<:primevideo:1502001410311716984>",
    chatgpt: "<:521605chatgpt:1502001751019094097>",
    capcut: "<:Capcut:1502002116405887039>",
    cda: "<:CDA:1508077411873325076>",

    // =========================
    // VPN
    // =========================
    nordvpn: "<:NORDVPN:1501999409343369400>",
    mullvad: "<:mullvad:1501999834159255712>",
    tunnelbear: "<:TUNNELBEARVPN:1502000450009042984>",

    // =========================
    // MIDDLEMAN / SHOP
    // =========================
    middleman: "<:LUDZIE:1500243884733894716>",
    cart: "<:SKLEP:1500243849535033577>",
    box: "<:SKLEP:1500243849535033577>",

    // =========================
    // INNE
    // =========================
    prime: "<:primevideo:1502001410311716984>"
  };

  // =========================================
  // PROWIZJE
  // =========================================
  const rates = {

    "BLIK->PAYPAL": 2,
    "BLIK->CRYPTO": 8,
    "BLIK->LTC": 8,
    "BLIK->SKRILL": 2,

    "KODBLIK->PAYPAL": 6,
    "KODBLIK->CRYPTO": 11,
    "KODBLIK->LTC": 11,
    "KODBLIK->SKRILL": 6,

    "PAYPAL->BLIK": 9,
    "PAYPAL->CRYPTO": 9,
    "PAYPAL->LTC": 9,
    "PAYPAL->SKRILL": 9,

    "CRYPTO->BLIK": 4,
    "CRYPTO->KODBLIK": 4,
    "CRYPTO->PAYPAL": 4,
    "CRYPTO->LTC": 4,
    "CRYPTO->SKRILL": 4,

    "LTC->BLIK": 4,
    "LTC->KODBLIK": 4,
    "LTC->PAYPAL": 4,
    "LTC->CRYPTO": 4,
    "PSC->BLIK": 11,
    "PSC->KODBLIK": 11,
    "PSC->PAYPAL": 11,
    "PSC->CRYPTO": 13,
    "PSC->LTC": 13,
    "PSC->SKRILL": 11,
    "SKRILL->BLIK": 9,
    "SKRILL->KODBLIK": 9,
    "SKRILL->PAYPAL": 9,
    "SKRILL->CRYPTO": 9,
    "SKRILL->LTC": 9,
    "VINTED->BLIK": 9,
    "VINTED->PAYPAL": 9,
    "VINTED->LTC": 9,
    "VINTED->CRYPTO": 9,
    "ZEN->BLIK": 4,
    "ZEN->PAYPAL": 4,
    "ZEN->LTC": 4,
    "ZEN->CRYPTO": 4,
    "BLIK->VINTED": 8,
    "PAYPAL->VINTED": 9,
    "LTC->VINTED": 4,
    "CRYPTO->VINTED": 4,
  };

  // =========================================
  // MENU
  // =========================================
  function createMenu() {

    return new ActionRowBuilder().addComponents(

      new StringSelectMenuBuilder()

        .setCustomId("ticket_select")

        .setPlaceholder("🎫 Wybierz kategorię")

        .addOptions([

          {
            label: "Wymiana waluty",
            description: "Wymiana metod płatności",
            value: "exchange",
            emoji: { id: "1500243849535033577" }
          },

          {
            label: "Zakup",
            description: "Kupno produktu/usługi",
            value: "buy",
            emoji: { id: "1500243849535033577" }
          },

          {
            label: "Pomoc",
            description: "Wsparcie administracji",
            value: "help",
            emoji: { id: "1500243961124618381" }
          },

          {
            label: "Middleman",
            description: "Usługa pośrednika",
            value: "middleman",
            emoji: { id: "1500243884733894716" }
          }
        ])
    );
  }


  function exchangeMethodOptions() {
    return [
      new StringSelectMenuOptionBuilder()
        .setLabel("BLIK")
        .setValue("BLIK")
        .setEmoji({ id: "1499784231608389742" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("KOD BLIK")
        .setValue("KODBLIK")
        .setEmoji({ id: "1499784231608389742" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("PAYPAL")
        .setValue("PAYPAL")
        .setEmoji({ id: "1499784258091483236" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("LTC")
        .setValue("LTC")
        .setEmoji({ id: "1499784285211726014" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("CRYPTO")
        .setValue("CRYPTO")
        .setEmoji({ id: "1499784635201224724" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("PSC")
        .setValue("PSC")
        .setEmoji({ id: "1519440223140970636", name: "MYPSC" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("SKRILL")
        .setValue("SKRILL")
        .setEmoji({ id: "1519440276492521472", name: "SKRILL" })
    ];
  }

  function currencyOptions() {
    return [
      new StringSelectMenuOptionBuilder()
        .setLabel("PLN")
        .setValue("PLN")
        .setEmoji("🇵🇱"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EUR")
        .setValue("EUR")
        .setEmoji("🇪🇺"),
      new StringSelectMenuOptionBuilder()
        .setLabel("USD")
        .setValue("USD")
        .setEmoji("🇺🇸")
    ];
  }

  function normalizeExchangeMethod(value) {
    const v = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (["BLIK", "KODBLIK", "PAYPAL", "LTC", "CRYPTO", "PSC", "SKRILL"].includes(v)) return v;
    if (v === "KOD-BLIK" || v === "KOD_BLIK") return "KODBLIK";
    return null;
  }

  function normalizeCurrency(value) {
    const v = String(value || "PLN").trim().toUpperCase();
    return ["PLN", "EUR", "USD"].includes(v) ? v : "PLN";
  }

  function displayExchangeMethod(value) {
    const v = normalizeExchangeMethod(value) || String(value || "").toUpperCase();
    if (v === "KODBLIK") return "KOD BLIK";
    return v;
  }

  function methodEmoji(value) {
    const v = normalizeExchangeMethod(value);
    if (v === "BLIK") return EMOJI.blik;
    if (v === "KODBLIK") return EMOJI.kodblik;
    if (v === "PAYPAL") return EMOJI.paypal;
    if (v === "LTC") return EMOJI.ltc;
    if (v === "CRYPTO") return EMOJI.crypto;
    if (v === "PSC") return EMOJI.psc;
    if (v === "SKRILL") return EMOJI.skrill;
    return EMOJI.money;
  }

  function currencyEmoji(value) {
    const v = normalizeCurrency(value);
    if (v === "PLN") return "🇵🇱";
    if (v === "EUR") return "🇪🇺";
    if (v === "USD") return "🇺🇸";
    return "💱";
  }

  function getExchangeInfoFromTicket(channel) {
    const topicParts = String(channel?.topic || "").split(":");
    const topicFrom = normalizeExchangeMethod(topicParts[3]);
    const topicTo = normalizeExchangeMethod(topicParts[4]);
    const topicCurrency = normalizeCurrency(topicParts[5]);

    if (topicFrom && topicTo) {
      return { from: topicFrom, to: topicTo, currency: topicCurrency };
    }

    const parts = cleanTicketName(channel?.name || "")
      .replace(/^lock-/, "")
      .replace(/^unlock-/, "")
      .split("-");

    const from = normalizeExchangeMethod(parts[0]);
    const to = normalizeExchangeMethod(parts[1]);

    return {
      from: from || "BLIK",
      to: to || "LTC",
      currency: "PLN"
    };
  }

  function getModalSelectValue(fields, customId) {
    const field = fields?.fields?.get(customId) || fields?.getField?.(customId);
    if (Array.isArray(field?.values) && field.values.length) return field.values[0];
    if (typeof field?.value === "string") return field.value;
    return "";
  }

  function createExchangeModal() {
    const modal = new ModalBuilder()
      .setCustomId("exchange_full_modal")
      .setTitle("Potrzebne informacje.");

    const amountInput = new TextInputBuilder()
      .setCustomId("exchange_amount")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Np. 48")
      .setRequired(true);

    const amountLabel = new LabelBuilder()
      .setLabel("JAKA KWOTA.")
      .setTextInputComponent(amountInput);

    const fromSelect = new StringSelectMenuBuilder()
      .setCustomId("exchange_from")
      .setPlaceholder("× Nie wybrałeś/aś żadnej opcji.")
      .setRequired(true)
      .addOptions(exchangeMethodOptions());

    const fromLabel = new LabelBuilder()
      .setLabel("Z CZEGO:")
      .setStringSelectMenuComponent(fromSelect);

    const toSelect = new StringSelectMenuBuilder()
      .setCustomId("exchange_to")
      .setPlaceholder("× Nie wybrałeś/aś żadnej opcji.")
      .setRequired(true)
      .addOptions(exchangeMethodOptions());

    const toLabel = new LabelBuilder()
      .setLabel("NA CO:")
      .setStringSelectMenuComponent(toSelect);

    const currencySelect = new StringSelectMenuBuilder()
      .setCustomId("exchange_currency")
      .setPlaceholder("PLN")
      .setRequired(true)
      .addOptions(currencyOptions());

    const currencyLabel = new LabelBuilder()
      .setLabel("JAKĄ WALUTĘ POSIADASZ:")
      .setStringSelectMenuComponent(currencySelect);

    return modal.addLabelComponents(
      amountLabel,
      fromLabel,
      toLabel,
      currencyLabel
    );
  }

  // =========================================
  // READY
  // =========================================
  client.once(Events.ClientReady, async () => {

    const channel =
      await client.channels.fetch(PANEL_CHANNEL_ID);

    if (!channel) return;

    const embed =
      new EmbedBuilder()

        .setColor(EMBED_COLOR)

        .setTitle(
          `${EMOJI.ticket} 🌟 StarX Exchange » WYMIANA`
        )

        .setDescription([

          `> ${EMOJI.arrow} Wybierz kategorię z menu poniżej`,
          `> ${EMOJI.arrow} Szybka i bezpieczna wymiana`,
          `> ${EMOJI.arrow} Prywatny ticket z realizatorem`,
          `> ${EMOJI.arrow} Automatyczne obliczenie prowizji`

        ].join("\n"))

        .setImage(
          "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand"
        )

        .setFooter({
          text: "© 2026 StarX Exchange"
        });

    await upsertPanel(channel, {
      embeds: [embed],
      components: [createMenu()]
    }, { customId: "ticket_select" });

    console.log("✅ Panel ticketów zaktualizowany.");
  });

  // =========================================
  // INTERACTIONS
  // =========================================
  // Przy każdym uruchomieniu policz także stare wiadomości +rep.
  client.once(Events.ClientReady, async () => {
    const guild = client.guilds.cache.first();
    await syncLegitCounterFromHistory(guild).catch(err =>
      console.log("LEGIT HISTORY SYNC ERROR:", err)
    );
  });

  // Po tym jak klient faktycznie wyśle legit checka na kanał LC,
  // dopiero wtedy zabierz mu dostęp do ticketa. Dzięki temu może skopiować wzór z ticketa.
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (message.channel.id !== LEGIT_CHECK_CHANNEL_ID) return;
      if (!message.content?.trim().toLowerCase().startsWith("+rep")) return;

      // Każdy +rep na kanale LC jest liczony, również bez aktywnego ticketa.
      // Pełna synchronizacja z historią uwzględnia stare wiadomości i restarty bota.
      store.confirmLatestPendingTransaction(message.author.id);
      await syncLegitCounterFromHistory(message.guild);

      const ticketId = pendingLegitTickets.get(message.author.id);
      if (!ticketId) return;

      const ticket = await message.guild.channels.fetch(ticketId).catch(() => null);
      if (!ticket) {
        pendingLegitTickets.delete(message.author.id);
        return;
      }

      await ticket.permissionOverwrites.edit(message.author.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      }).catch(() => {});

      pendingLegitTickets.delete(message.author.id);
    } catch (err) {
      console.log("LEGIT ACCESS REMOVE ERROR:", err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {

    // =========================
    // MENU
    // =========================
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {

      const type = interaction.values[0];

      // =====================================
      // CHECK EXISTING TICKET
      // =====================================
      const existing =
        interaction.guild.channels.cache.find(c =>
          c.topic?.startsWith(interaction.user.id)
        );

      if (existing)
        return interaction.reply({
          content: `${EMOJI.warning} Masz już ticket: ${existing}`,
          ephemeral: true
        });

      // =====================================
      // EXCHANGE
      // =====================================
      if (type === "exchange") {
        return interaction.showModal(createExchangeModal());
      }

      if (type === "middleman") {
        return interaction.showModal(createMiddlemanModal());
      }

      // =====================================
      // CATEGORY NAME
      // =====================================
      let categoryName = "Pomoc";

      if (type === "buy")
        categoryName = "Zakup";

      if (type === "middleman")
        categoryName = "Middleman";

      // =====================================
      // CREATE CHANNEL
      // =====================================
      const channel =
        await interaction.guild.channels.create({

          name:
            unlockTicketName(`${type}-${interaction.user.username}`),

          parent: CATEGORY_UNCLAIMED_ID,

          topic:
            `${interaction.user.id}:${type}`,

          type:
            ChannelType.GuildText,

          permissionOverwrites: [

            {
              id: interaction.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },

            {
              id: interaction.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
              ]
            },

            {
              id: REALIZATOR_ROLE_ID,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages
              ]
            }
          ]
        });

      // Rola Klient NIE jest nadawana przy utworzeniu ticketa.
      // Dostanie ją dopiero kupujący po wysłaniu wiadomości LC.

      // =====================================
      // BUTTON
      // =====================================
      const row = ticketButtons();

      // =====================================
      // EMBED
      // =====================================
      const embed =
        new EmbedBuilder()

          .setColor(EMBED_COLOR)

          .setTitle(
            `${EMOJI.ticket} 🌟 StarX Exchange × ${categoryName.toUpperCase()}`
          )

          .setDescription([

            `> ${EMOJI.arrow} Użytkownik ${interaction.user} utworzył ticket`,
            `> ${EMOJI.arrow} Kategoria: \`${categoryName}\``,

            ``,

            `> ${EMOJI.arrow} Realizator odpowie najszybciej jak to możliwe`

          ].join("\n"))
          .setImage(BANNER_TICKET_URL)

          .setFooter({
            text: "© 2026 StarX Exchange"
          });

      // =====================================
      // SEND
      // =====================================
      await channel.send({
        content:
          `${interaction.user} <@&${REALIZATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content:
          `${EMOJI.ticket} Ticket został utworzony: ${channel}`,
        ephemeral: true
      });
    }

    // =========================
    // MIDDLEMAN MODAL SUBMIT
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "middleman_modal") {
      const otherUserId = parseUserId(interaction.fields.getTextInputValue("middleman_user_id"));

      if (!otherUserId) {
        return interaction.reply({
          content: `${EMOJI.warning} Podaj poprawne ID uzytkownika.`,
          ephemeral: true
        });
      }

      if (otherUserId === interaction.user.id) {
        return interaction.reply({
          content: `${EMOJI.warning} Nie mozesz dodac samego siebie.`,
          ephemeral: true
        });
      }

      const otherMember = await interaction.guild.members.fetch(otherUserId).catch(() => null);

      if (!otherMember) {
        return interaction.reply({
          content: `${EMOJI.warning} Nie znaleziono takiego uzytkownika na serwerze.`,
          ephemeral: true
        });
      }

      const existing = interaction.guild.channels.cache.find(c => c.topic?.startsWith(interaction.user.id));
      if (existing) {
        return interaction.reply({
          content: `${EMOJI.warning} Masz juz ticket: ${existing}`,
          ephemeral: true
        });
      }

      const channel = await interaction.guild.channels.create({
        name: unlockTicketName(`middleman-${interaction.user.username}`),
        parent: CATEGORY_UNCLAIMED_ID,
        topic: `${interaction.user.id}:middleman:${otherUserId}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          },
          {
            id: otherUserId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          },
          {
            id: REALIZATOR_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`${EMOJI.middleman} StarX Exchange x MIDDLEMAN`)
        .setDescription([
          `> ${EMOJI.arrow} Uzytkownik ${interaction.user} utworzyl ticket middleman.`,
          `> ${EMOJI.arrow} Dodana osoba: <@${otherUserId}>`,
          ``,
          `> ${EMOJI.arrow} Realizator odpowie najszybciej jak to mozliwe.`
        ].join("\n"))
        .setImage(BANNER_TICKET_URL)
        .setFooter({ text: "© 2026 StarX Exchange" });

      await channel.send({
        content: `${interaction.user} <@${otherUserId}> <@&${REALIZATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [ticketButtons()]
      });

      return interaction.reply({
        content: `${EMOJI.ticket} Ticket zostal utworzony: ${channel}`,
        ephemeral: true
      });
    }

    // =========================
    // EXCHANGE MODAL SUBMIT
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "exchange_full_modal") {
      const amount = interaction.fields.getTextInputValue("exchange_amount");
      const from = normalizeExchangeMethod(getModalSelectValue(interaction.fields, "exchange_from"));
      const to = normalizeExchangeMethod(getModalSelectValue(interaction.fields, "exchange_to"));
      const currency = normalizeCurrency(getModalSelectValue(interaction.fields, "exchange_currency"));

      if (!amount || isNaN(amount)) {
        return interaction.reply({
          content: `${EMOJI.warning} Kwota musi być liczbą.`,
          ephemeral: true
        });
      }

      if (!from || !to) {
        return interaction.reply({
          content: `${EMOJI.warning} Wybierz poprawne metody płatności.`,
          ephemeral: true
        });
      }

      const existing = interaction.guild.channels.cache.find(c => c.topic?.startsWith(interaction.user.id));
      if (existing) {
        return interaction.reply({
          content: `${EMOJI.warning} Masz już ticket: ${existing}`,
          ephemeral: true
        });
      }

      const exchange = `${from}->${to}`;
      const percent = rates[exchange];

      if (!percent) {
        return interaction.reply({
          content: `${EMOJI.warning} Nie mozna wymienic tej metody.`,
          ephemeral: true
        });
      }

      const numericAmount = Number(amount);
      const percentageFee = (numericAmount * percent) / 100;
      const fee = Math.max(percentageFee, 3);
      const afterFee = (numericAmount - fee).toFixed(2);

      const exchangePayload = {
        userId: interaction.user.id,
        amount: numericAmount,
        from,
        to,
        currency,
        percent,
        fee: Number(fee.toFixed(2)),
        afterFee: Number(afterFee),
        createdAt: Date.now()
      };

      const channel = await interaction.guild.channels.create({
        name: unlockTicketName(`${from.toLowerCase()}-${to.toLowerCase()}-${interaction.user.username}`),
        parent: CATEGORY_UNCLAIMED_ID,
        topic: `${interaction.user.id}:exchange:${amount}:${from}:${to}:${currency}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          },
          {
            id: REALIZATOR_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`${EMOJI.money} 🌟 StarX Exchange × WYMIANA WALUTY`)
        .setDescription([
          `> ${EMOJI.arrow} Użytkownik ${interaction.user} utworzył ticket wymiany.`,
          `> ${EMOJI.arrow} Realizator odpowie najszybciej jak to możliwe.`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${EMOJI.money} **JAKA KWOTA:**`,
          `> ${formatCurrency(amount, currency)}`,
          ``,
          `${methodEmoji(from)} **Z CZEGO:**`,
          `> ${displayExchangeMethod(from)}`,
          ``,
          `${methodEmoji(to)} **NA CO:**`,
          `> ${displayExchangeMethod(to)}`,
          ``,
          `${currencyEmoji(currency)} **JAKĄ WALUTĘ POSIADASZ:**`,
          `> ${currency}`,
          ``,
          `${EMOJI.zap} **PROWIZJA:**`,
          `> ${percent}% — ${formatCurrency(fee, currency)} (minimum 3 PLN)`,
          ``,
          `${EMOJI.pin} **PO PROWIZJI:**`,
          `> ${formatCurrency(afterFee, currency)}`
        ].join("\n"))
        .setImage(BANNER_TICKET_URL)
        .setFooter({ text: "© 2026 StarX Exchange" });

      exchangeData.set(channel.id, exchangePayload);

      await channel.send({
        content: `${interaction.user} <@&${REALIZATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [ticketButtons()]
      });

      return interaction.reply({
        content: `${EMOJI.ticket} Ticket został utworzony: ${channel}`,
        ephemeral: true
      });
    }


    // =========================
    // CLAIM BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId === "claim_ticket") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.warning} Nie jesteś realizatorem.`, ephemeral: true });
      }

      if (claimedTickets.has(interaction.channel.id)) {
        return interaction.reply({ content: `${EMOJI.warning} Ticket jest już przejęty.`, ephemeral: true });
      }

      claimedTickets.set(interaction.channel.id, interaction.user.id);

      await interaction.channel.permissionOverwrites.edit(REALIZATOR_ROLE_ID, { ViewChannel: false }).catch(() => {});
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      }).catch(() => {});

      await interaction.channel.setParent(CATEGORY_CLAIMED_ID, { lockPermissions: false }).catch(() => {});
      await interaction.channel.setName(lockTicketName(interaction.channel.name)).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("🌟 StarX Exchange × TICKET PRZEJĘTY")
        .setDescription(
          `> ${EMOJI.arrow} Twój ticket został przejęty przez: ${interaction.user}`
        )
        .setFooter({ text: "© 2026 StarX Exchange" });

      await interaction.message.edit({ components: [ticketButtons(true)] }).catch(() => {});

      return interaction.reply({
        content: `${interaction.channel.topic?.split(":")?.[0] ? `<@${interaction.channel.topic.split(":")[0]}>` : ""}`,
        embeds: [embed]
      });
    }

    // =========================
    // UNCLAIM BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId === "unclaim_ticket") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.warning} Nie jesteś realizatorem.`, ephemeral: true });
      }

      const claimedUserId = claimedTickets.get(interaction.channel.id);
      if (!claimedUserId) {
        await interaction.message.edit({ components: [ticketButtons(false)] }).catch(() => {});
        return interaction.reply({ content: `${EMOJI.warning} Ticket nie jest przejęty.`, ephemeral: true });
      }

      await interaction.channel.permissionOverwrites.edit(REALIZATOR_ROLE_ID, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      }).catch(() => {});

      await interaction.channel.permissionOverwrites.delete(claimedUserId).catch(() => {});
      await interaction.channel.setParent(CATEGORY_UNCLAIMED_ID, { lockPermissions: false }).catch(() => {});
      await interaction.channel.setName(unlockTicketName(interaction.channel.name)).catch(() => {});
      claimedTickets.delete(interaction.channel.id);
      await interaction.message.edit({ components: [ticketButtons(false)] }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("🌟 StarX Exchange × TICKET ODPRZYJĘTY")
        .setDescription(`> ${EMOJI.arrow} Ticket został odprzyjęty przez: ${interaction.user}`)
        .setFooter({ text: "© 2026 StarX Exchange" });

      return interaction.reply({ embeds: [embed] });
    }


    // =========================
    // PURCHASE LEGIT MODAL
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "purchase_legit_modal") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({
          content: `${EMOJI.warning} Tylko realizator może wysłać legit check.`,
          ephemeral: true
        });
      }

      const topicParts = String(interaction.channel.topic || "").split(":");
      const clientId = topicParts?.[0];

      const item = interaction.fields.getTextInputValue("purchase_item").trim();
      const amountRaw = interaction.fields.getTextInputValue("purchase_amount").trim().replace(",", ".");
      const method = interaction.fields.getTextInputValue("purchase_method").trim().toUpperCase();

      const amountNumber = Number(amountRaw);
      const amountText = Number.isFinite(amountNumber) ? `${amountNumber.toFixed(0)}PLN` : `${amountRaw}PLN`;
      const legitText = `+rep ${interaction.user} Purchased ${item} ${amountText} [${method}]`;

      saveCustomerTransaction(interaction, {
        clientId,
        amount: amountNumber,
        type: "purchase",
        description: `Zakup: ${item}`
      });

      if (clientId) {
        await giveClientRoleById(interaction.guild, clientId);
        pendingLegitTickets.set(clientId, interaction.channel.id);
      }

      await interaction.reply({
        content: clientId ? `<@${clientId}>` : undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("🌟 StarX Exchange × WYSTAW LEGIT CHECKA")
            .setDescription([
              `> ${EMOJI.arrow} Dziękujemy ${clientId ? `<@${clientId}>` : ""} za **skorzystanie z naszych usług**.`,
              `> ${EMOJI.arrow} Mamy nadzieję, że to **nie ostatni raz**!`,
              "",
              `> ${EMOJI.arrow} Prosimy, abyś **wystawił legit checka** na kanale <#${LEGIT_CHECK_CHANNEL_ID}>`,
              "",
              `> ${EMOJI.arrow} **Wzór:**`,
              "```text",
              legitText,
              "```",
              "",
              `> ${EMOJI.arrow} Po wystawieniu legit checka ticket zostanie **automatycznie zamknięty**.`
            ].join("\n"))
            .setImage(BANNER_LEGIT_URL)
            .setFooter({ text: "© 2026 StarX Exchange" })
        ]
      });

      try {
        const sendTempPing = async (channelId) => {
          if (!clientId || !channelId) return;
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (!channel?.isTextBased()) return;
          const msg = await channel.send({ content: `<@${clientId}>` }).catch(() => null);
          if (msg) setTimeout(() => msg.delete().catch(() => {}), 1000);
        };

        await sendTempPing(LEGIT_CHECK_CHANNEL_ID);
        await sendTempPing(REACTION_LEGIT_CHANNEL_ID);
      } catch (err) {
        console.log("PURCHASE LEGIT PING ERROR:", err);
      }

      return;
    }

    // =========================
    // MIDDLEMAN LEGIT MODAL
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "middleman_legit_modal") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({
          content: `${EMOJI.warning} Tylko realizator moze wyslac legit check.`,
          ephemeral: true
        });
      }

      const topicParts = String(interaction.channel.topic || "").split(":");
      const clientId = topicParts?.[0];
      const claimedUserId = claimedTickets.get(interaction.channel.id) || interaction.user.id;
      const amountRaw = interaction.fields.getTextInputValue("middleman_legit_amount").trim().replace(",", ".");
      const amountNumber = Number(amountRaw);
      const amountText = Number.isFinite(amountNumber) ? `${amountNumber.toFixed(0)}PLN` : `${amountRaw}PLN`;
      const legitText = `+rep <@${claimedUserId}> Middleman ${amountText}`;

      saveCustomerTransaction(interaction, {
        clientId,
        amount: amountNumber,
        type: "middleman",
        description: "Usługa Middleman"
      });

      if (clientId) {
        await giveClientRoleById(interaction.guild, clientId);
        pendingLegitTickets.set(clientId, interaction.channel.id);
      }

      await interaction.reply({
        content: clientId ? `<@${clientId}>` : undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("StarX Exchange x WYSTAW LEGIT CHECKA")
            .setDescription([
              `> ${EMOJI.arrow} Dziekujemy ${clientId ? `<@${clientId}>` : ""} za skorzystanie z middlemana.`,
              "",
              `> ${EMOJI.arrow} Wystaw legit checka na kanale <#${LEGIT_CHECK_CHANNEL_ID}>`,
              "",
              `> ${EMOJI.arrow} Wzor:`,
              "```text",
              legitText,
              "```",
              "",
              `> ${EMOJI.arrow} Po wystawieniu legit checka ticket zostanie automatycznie zamkniety.`
            ].join("\n"))
            .setImage(BANNER_LEGIT_URL)
            .setFooter({ text: "© 2026 StarX Exchange" })
        ]
      });

      try {
        const sendTempPing = async (channelId) => {
          if (!clientId || !channelId) return;
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (!channel?.isTextBased()) return;
          const msg = await channel.send({ content: `<@${clientId}>` }).catch(() => null);
          if (msg) setTimeout(() => msg.delete().catch(() => {}), 1000);
        };

        await sendTempPing(LEGIT_CHECK_CHANNEL_ID);
        await sendTempPing(REACTION_LEGIT_CHANNEL_ID);
      } catch (err) {
        console.log("MIDDLEMAN LEGIT PING ERROR:", err);
      }

      return;
    }

    // =========================
    // SEND LEGIT CHECK BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId === "send_legit_check") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({
          content: `${EMOJI.warning} Tylko realizator może wysłać legit check.`,
          ephemeral: true
        });
      }

      const topicParts = String(interaction.channel.topic || "").split(":");
      const ticketType = topicParts?.[1];

      if (ticketType === "buy") {
        return interaction.showModal(createPurchaseLegitModal());
      }

      if (ticketType === "middleman") {
        return interaction.showModal(createMiddlemanLegitModal());
      }

      const clientId = topicParts?.[0];
      const amount = topicParts?.[2] || "0.00";
      const exchangeInfo = getExchangeInfoFromTicket(interaction.channel);
      const fromTo = `${displayExchangeMethod(exchangeInfo.from)} TO ${displayExchangeMethod(exchangeInfo.to)}`;
      const legitText = `+rep ${interaction.user} Exchanged ${fromTo} ${formatCurrency(amount, exchangeInfo.currency)}`;

      saveCustomerTransaction(interaction, {
        clientId,
        amount: Number(amount),
        type: "exchange",
        description: `Wymiana ${fromTo}`,
        currency: exchangeInfo.currency
      });

      if (clientId) {
        await giveClientRoleById(interaction.guild, clientId);
        pendingLegitTickets.set(clientId, interaction.channel.id);
      }

      await interaction.reply({
        content: clientId ? `<@${clientId}>` : undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("🌟 StarX Exchange × WYSTAW LEGIT CHECKA")
            .setDescription([
              `> ${EMOJI.arrow} Dziękujemy ${clientId ? `<@${clientId}>` : ""} za **skorzystanie z naszych usług**.`,
              `> ${EMOJI.arrow} Mamy nadzieję, że to **nie ostatni raz**!`,
              "",
              `> ${EMOJI.arrow} Prosimy, abyś **wystawił legit checka** na kanale <#${LEGIT_CHECK_CHANNEL_ID}>`,
              "",
              `> ${EMOJI.arrow} **Wzór:**`,
              "```text",
              legitText,
              "```",
              "",
              `> ${EMOJI.arrow} Po wystawieniu legit checka ticket zostanie **automatycznie zamknięty**.`
            ].join("\n"))
            .setImage(BANNER_LEGIT_URL)
            .setFooter({ text: "© 2026 StarX Exchange" })
        ]
      });

      try {
        const sendTempPing = async (channelId) => {
          if (!clientId || !channelId) return;
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (!channel?.isTextBased()) return;
          const msg = await channel.send({ content: `<@${clientId}>` }).catch(() => null);
          if (msg) setTimeout(() => msg.delete().catch(() => {}), 1000);
        };

        await sendTempPing(LEGIT_CHECK_CHANNEL_ID);
        await sendTempPing(REACTION_LEGIT_CHANNEL_ID);
      } catch (err) {
        console.log("LEGIT PING ERROR:", err);
      }

      return;
    }

    // =========================
    // CLOSE
    // =========================
    if (
      interaction.isButton() &&
      interaction.customId === "close_ticket"
    ) {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({
          content: `${EMOJI.warning} Tylko realizator może zamknąć ticket.`,
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `${EMOJI.lock} Ticket zostanie zamknięty.`,
        ephemeral: true
      }).catch(() => {});

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 1000);

      return;
    }
  });
};

