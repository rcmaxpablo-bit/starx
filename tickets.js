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
  const pendingPaymentData = new Map(); // channelId:userId -> dane z /dane
  const autoLegitSent = new Set(); // channelId - ochrona przed podwójnym wysłaniem
  const pendingExchanges = new Map();

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

  let legitRenameTimer = null;
  let pendingLegitCount = null;
  let legitRenameRetryTimer = null;
  let lastLegitChannelName = null;

  async function updateLegitCounterChannel(guild, count, attempt = 1) {
    const settings = store.read("settings");
    const prefix = "│✅・legit-check→";
    const channelId = LEGIT_CHECK_CHANNEL_ID;
    const safeCount = Math.max(0, Number(count) || 0);

    settings.legitCounterChannelId = channelId;
    settings.legitCounterChannelPrefix = prefix;
    settings.legitCount = safeCount;
    store.write("settings", settings);

    // Pobieranie globalne działa także wtedy, gdy guild cache nie jest jeszcze gotowy.
    let channel = await client.channels.fetch(channelId, { force: true }).catch(err => {
      console.error(`LEGIT COUNTER FETCH ERROR (${channelId}):`, err?.message || err);
      return null;
    });
    if (!channel && guild) {
      channel = await guild.channels.fetch(channelId, { force: true }).catch(() => null);
    }

    if (!channel || typeof channel.setName !== 'function') {
      console.error(`LEGIT COUNTER: kanał ${channelId} nie istnieje albo nie można zmienić jego nazwy.`);
      return false;
    }

    const newName = `${prefix}${safeCount}`;
    if (channel.name === newName) {
      console.log(`✅ LEGIT COUNTER bez zmian: ${newName}`);
      return true;
    }

    try {
      const previousName = channel.name;
      await channel.setName(newName, `Synchronizacja ${safeCount} wiadomości +rep`);
      lastLegitChannelName = newName;
      console.log(`✅ LEGIT COUNTER: ${previousName} → ${newName}`);
      return true;
    } catch (err) {
      const retryAfterMs = Math.max(
        15_000,
        Number(err?.retry_after || err?.rawError?.retry_after || err?.data?.retry_after || 0) * 1000 || 0
      );
      console.error(`❌ LEGIT COUNTER RENAME ERROR (próba ${attempt}):`, err?.message || err);

      // Discord ogranicza częstotliwość zmian nazwy kanału. Zachowujemy najnowszy
      // wynik i ponawiamy zmianę po czasie wskazanym przez API (lub po 10 minutach).
      pendingLegitCount = safeCount;
      if (legitRenameRetryTimer) clearTimeout(legitRenameRetryTimer);
      const delay = retryAfterMs > 15_000 ? retryAfterMs + 1000 : 10 * 60 * 1000;
      legitRenameRetryTimer = setTimeout(() => {
        legitRenameRetryTimer = null;
        updateLegitCounterChannel(guild, pendingLegitCount, attempt + 1).catch(() => {});
      }, delay);
      console.log(`⏳ LEGIT COUNTER: ponowna próba za ${Math.ceil(delay / 1000)} s.`);
      return false;
    }
  }

  // Łączy wiele szybkich zmian w jedną zmianę nazwy kanału. Discord mocno
  // ogranicza częstotliwość zmiany nazw kanałów.
  function scheduleLegitCounterRename(guild, count) {
    pendingLegitCount = Math.max(0, Number(count) || 0);
    if (legitRenameTimer) clearTimeout(legitRenameTimer);
    legitRenameTimer = setTimeout(async () => {
      const value = pendingLegitCount;
      legitRenameTimer = null;
      await updateLegitCounterChannel(guild, value);
    }, 1500);
  }

  function parseLegitMessage(content) {
    const text = String(content || '').trim();
    if (!text.toLowerCase().startsWith('+rep')) return null;

    const amountMatches = [...text.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*pln\b/gi)];
    const lastAmount = amountMatches.at(-1);
    const amount = lastAmount ? Number(lastAmount[1].replace(',', '.')) : 0;

    let description = text
      .replace(/^\+rep\s*/i, '')
      .replace(/<@!?\d+>/g, '')
      .replace(/\b(?:purchased|exchanged|bought|zakupiono|kupiono)\b/i, '')
      .replace(/(\d+(?:[.,]\d{1,2})?)\s*pln\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = 'Zakup z legit checka';
    return { amount, description };
  }

  async function resolveLegitCustomerId(message) {
    if (!message.guild) return null;

    // Zwykły +rep przypisujemy autorowi wiadomości.
    if (!message.webhookId && !message.author?.bot) return message.author?.id || null;

    // Automatyczne LC wysyłane webhookiem ma nazwę: "username [ Automatyczne LC ]".
    const rawName = String(message.author?.username || '').replace(/\s*\[.*$/i, '').trim();
    if (!rawName) return null;

    await message.guild.members.fetch().catch(() => null);
    const lowered = rawName.toLowerCase();
    const member = message.guild.members.cache.find(m => {
      const names = [m.user.username, m.user.globalName, m.displayName].filter(Boolean);
      return names.some(name => String(name).toLowerCase() === lowered);
    });
    return member?.id || null;
  }

  async function importLegitMessageToCustomer(message, source = 'legit_history') {
    const parsed = parseLegitMessage(message.content);
    if (!parsed) return { created: false, reason: 'not_rep' };

    const userId = await resolveLegitCustomerId(message);
    if (!userId) {
      console.log(`LEGIT IMPORT: nie udało się przypisać klienta dla wiadomości ${message.id}.`);
      return { created: false, reason: 'customer_not_found' };
    }

    return store.importLegitTransaction({
      messageId: message.id,
      userId,
      amount: parsed.amount,
      description: parsed.description,
      channelId: message.channel.id,
      createdAt: message.createdAt?.toISOString?.() || new Date().toISOString(),
      source
    });
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
        // Liczymy także wiadomości botów i webhooków (np. Automatyczne LC),
        // o ile ich treść zaczyna się od +rep.
        if (msg.content?.trim().toLowerCase().startsWith("+rep")) {
          total += 1;
          await importLegitMessageToCustomer(msg, 'legit_history');
        }
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
        .setCustomId(isClaimed ? "unclaim_ticket" : "claim_ticket")
        .setLabel(isClaimed ? "Odprzejmij Ticket" : "Przejmij Ticket")
        .setEmoji(isClaimed ? "🔓" : "🔒")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_settings")
        .setLabel("Ustawienia Ticketa")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Zamknij/Wykonane")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("send_legit_check")
        .setLabel("Legit Check")
        .setEmoji("📣")
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


  function normalizeExchangeMethod(value) {
    const v = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (["BLIK", "KODBLIK", "PAYPAL", "LTC", "BTC", "ETH", "SOL", "USDT", "CRYPTO", "PSC", "SKRILL", "VINTED", "ZEN"].includes(v)) return v;
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
    if (["BTC", "ETH", "SOL", "USDT"].includes(v)) return EMOJI.crypto;
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

  function createExchangeAmountModal() {
    const modal = new ModalBuilder()
      .setCustomId("exchange_amount_modal")
      .setTitle("Kwota wymiany");

    const amountInput = new TextInputBuilder()
      .setCustomId("exchange_amount")
      .setLabel("JAKA KWOTA")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Np. 48")
      .setRequired(true);

    return modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  }

  function exchangeChoiceRows(selection = {}) {
    const methods = [
      ["BLIK", EMOJI.blik], ["KODBLIK", EMOJI.kodblik], ["PAYPAL", EMOJI.paypal],
      ["LTC", EMOJI.ltc], ["BTC", "🪙"], ["ETH", "🔷"], ["SOL", "🟣"],
      ["USDT", "💵"], ["CRYPTO", EMOJI.crypto], ["PSC", EMOJI.psc], ["SKRILL", EMOJI.skrill]
    ];
    const currencies = [["PLN", "🇵🇱"], ["EUR", "🇪🇺"], ["USD", "🇺🇸"]];
    const menu = (id, placeholder, values, selected) => new StringSelectMenuBuilder()
      .setCustomId(id).setPlaceholder(selected || placeholder).addOptions(values.map(([value, emoji]) => {
        const option = new StringSelectMenuOptionBuilder().setLabel(value).setValue(value).setEmoji(emoji);
        if (value === selected) option.setDefault(true);
        return option;
      }));
    return [
      new ActionRowBuilder().addComponents(menu("exchange_from_select", "Z czego?", methods, selection.from)),
      new ActionRowBuilder().addComponents(menu("exchange_to_select", "Na co?", methods, selection.to)),
      new ActionRowBuilder().addComponents(menu("exchange_currency_select", "Waluta", currencies, selection.currency))
    ];
  }

  function isCryptoMethod(value) {
    return ["LTC", "BTC", "ETH", "SOL", "USDT", "CRYPTO"].includes(normalizeExchangeMethod(value));
  }

  function rateMethod(value) {
    const normalized = normalizeExchangeMethod(value);
    return ["BTC", "ETH", "SOL", "USDT"].includes(normalized) ? "CRYPTO" : normalized;
  }

  function calculateExchange(amount, from, to, currency = "PLN") {
    const numericAmount = Number(String(amount).replace(",", "."));
    const percent = rates[`${rateMethod(from)}->${rateMethod(to)}`];
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isFinite(percent)) return null;
    const percentageFee = (numericAmount * percent) / 100;
    const fee = Math.max(percentageFee, 3);
    // Zgodnie z wymaganiem zawsze obcinamy do pełnych 10 groszy w dół.
    const afterFee = Math.floor((numericAmount - fee) * 10) / 10;
    return {
      amount: numericAmount,
      from: normalizeExchangeMethod(from),
      to: normalizeExchangeMethod(to),
      currency: normalizeCurrency(currency),
      percent,
      fee: Number(fee.toFixed(2)),
      afterFee: Number(afterFee.toFixed(2))
    };
  }

  function buildExchangeEmbed(data, userMention) {
    return new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`${EMOJI.money} 🌟 StarX Exchange × WYMIANA WALUTY`)
      .setDescription([
        `> ${EMOJI.arrow} Użytkownik ${userMention} utworzył ticket wymiany.`,
        `> ${EMOJI.arrow} Realizator odpowie najszybciej jak to możliwe.`,
        ``, `━━━━━━━━━━━━━━━━━━━━━━━`, ``,
        `${EMOJI.money} **JAKA KWOTA:**`, `> ${formatCurrency(data.amount, data.currency)}`, ``,
        `${methodEmoji(data.from)} **Z CZEGO:**`, `> ${displayExchangeMethod(data.from)}`, ``,
        `${methodEmoji(data.to)} **NA CO:**`, `> ${displayExchangeMethod(data.to)}`, ``,
        `${currencyEmoji(data.currency)} **JAKĄ WALUTĘ POSIADASZ:**`, `> ${data.currency}`, ``,
        `${EMOJI.zap} **PROWIZJA:**`, `> ${data.percent}% — ${formatCurrency(data.fee, data.currency)} (minimum 3 PLN)`, ``,
        `${EMOJI.pin} **PO PROWIZJI:**`, `> ${formatCurrency(data.afterFee, data.currency)}`
      ].join("\n"))
      .setImage(BANNER_TICKET_URL)
      .setFooter({ text: "© 2026 StarX Exchange" });
  }

  function createTicketSettingsModal(channel) {
    const current = exchangeData.get(channel.id) || (() => {
      const parts = String(channel.topic || "").split(":");
      const calculated = calculateExchange(parts[2], parts[3], parts[4], parts[5]);
      return calculated;
    })();
    return new ModalBuilder()
      .setCustomId("ticket_settings_modal")
      .setTitle("Ustawienia ticketa")
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("settings_amount").setLabel("Kwota wymiany")
          .setValue(current ? current.amount.toFixed(2) : "")
          .setPlaceholder("Np. 50").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("settings_from").setLabel("Metoda płatności (z czego)")
          .setValue(current ? displayExchangeMethod(current.from) : "BLIK")
          .setPlaceholder("BLIK / PAYPAL / LTC").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId("settings_to").setLabel("Waluta/metoda docelowa (na co)")
          .setValue(current ? displayExchangeMethod(current.to) : "LTC")
          .setPlaceholder("LTC / BTC / ETH / SOL / USDT").setStyle(TextInputStyle.Short).setRequired(true))
      );
  }

  async function syncTicketEmbeds(channel, data) {
    const clientId = String(channel.topic || "").split(":")[0];
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) return 0;
    let edited = 0;
    for (const message of messages.values()) {
      if (message.author.id !== client.user.id || !message.embeds.length) continue;
      const embeds = message.embeds.map(embed => {
        const json = embed.toJSON();
        const text = `${json.title || ""}\n${json.description || ""}`;
        if (/WYMIANA WALUTY|PODSUMOWANIE WYMIANY|Informacje O Transakcji/i.test(text)) {
          return buildExchangeEmbed(data, clientId ? `<@${clientId}>` : "użytkownik");
        }
        if (/WYSTAW LEGIT CHECKA|LEGIT CHECK/i.test(text) && json.description) {
          const fromTo = `${displayExchangeMethod(data.from)} TO ${displayExchangeMethod(data.to)}`;
          json.description = json.description.replace(/Exchanged\s+[^\n`]+/i,
            `Exchanged ${fromTo} ${formatCurrency(data.amount, data.currency)}`);
          return EmbedBuilder.from(json);
        }
        return EmbedBuilder.from(json);
      });
      const changed = embeds.some((embed, i) => JSON.stringify(embed.toJSON()) !== JSON.stringify(message.embeds[i].toJSON()));
      if (changed) {
        await message.edit({ embeds }).catch(err => console.error("TICKET SYNC EDIT ERROR:", err?.message || err));
        edited += 1;
      }
    }
    return edited;
  }

  function createPaymentDataModal(method) {
    const modal = new ModalBuilder().setCustomId("payment_data_modal").setTitle(`Dane płatności • ${displayExchangeMethod(method)}`);
    if (isCryptoMethod(method)) {
      return modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
        .setCustomId("wallet_address").setLabel("Adres portfela")
        .setPlaceholder(`Adres ${displayExchangeMethod(method)}`).setStyle(TextInputStyle.Short).setRequired(true)));
    }
    return modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("payment_receiver").setLabel("Odbiorca").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("payment_title").setLabel("Tytuł").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("payment_phone").setLabel("Numer telefonu").setStyle(TextInputStyle.Short).setRequired(true))
    );
  }

  async function sendExchangeLegit(channel, exchangerUser, deleteMessage = null) {
    if (autoLegitSent.has(channel.id)) return false;
    const parts = String(channel.topic || "").split(":");
    if (parts[1] !== "exchange") return false;
    const data = exchangeData.get(channel.id) || calculateExchange(parts[2], parts[3], parts[4], parts[5]);
    if (!data) return false;
    autoLegitSent.add(channel.id);
    const clientId = parts[0];
    const fromTo = `${displayExchangeMethod(data.from)} TO ${displayExchangeMethod(data.to)}`;
    const legitText = `+rep <@${exchangerUser.id}> Exchanged ${fromTo} ${formatCurrency(data.amount, data.currency)}`;
    await channel.send({
      content: clientId ? `<@${clientId}>` : undefined,
      embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle("🌟 StarX Exchange × WYSTAW LEGIT CHECKA")
        .setDescription([
          `> ${EMOJI.arrow} Dziękujemy ${clientId ? `<@${clientId}>` : ""} za **skorzystanie z naszych usług**.`,
          `> ${EMOJI.arrow} Prosimy o wystawienie legit checka na kanale <#${LEGIT_CHECK_CHANNEL_ID}>`, "",
          `> ${EMOJI.arrow} **Wzór:**`, "```text", legitText, "```", "",
          `> ${EMOJI.arrow} Po wystawieniu legit checka ticket zostanie **automatycznie zamknięty**.`
        ].join("\n")).setImage(BANNER_LEGIT_URL).setFooter({ text: "© 2026 StarX Exchange" })]
    });
    if (deleteMessage) await deleteMessage.delete().catch(() => {});
    return true;
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
  // Obsługa licznika LC i Panelu Klienta znajduje się w customerLegitSystem.js.

  client.on(Events.InteractionCreate, async (interaction) => {
    try {

    // =========================
    // WYBÓR DANYCH WYMIANY
    // =========================
    if (interaction.isStringSelectMenu() && interaction.customId.endsWith("_select") && interaction.customId.startsWith("exchange_")) {
      const selection = pendingExchanges.get(interaction.user.id) || {};
      const key = { exchange_from_select: "from", exchange_to_select: "to", exchange_currency_select: "currency" }[interaction.customId];
      selection[key] = interaction.values[0];
      pendingExchanges.set(interaction.user.id, selection);
      if (selection.from && selection.to && selection.currency) {
        return interaction.showModal(createExchangeAmountModal());
      }
      return interaction.update({ components: exchangeChoiceRows(selection) });
    }

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
        pendingExchanges.set(interaction.user.id, {});
        return interaction.reply({
          content: `${EMOJI.money} Wybierz metody wymiany i walutę:`,
          components: exchangeChoiceRows(),
          ephemeral: true
        });
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
      // Utworzenie kanału i wysłanie wiadomości może potrwać dłużej niż trzy
      // sekundy. Potwierdzamy interakcję przed rozpoczęciem zapytań do API.
      await interaction.deferReply({ ephemeral: true });

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

      return interaction.editReply({
        content:
          `${EMOJI.ticket} Ticket został utworzony: ${channel}`
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

      await interaction.deferReply({ ephemeral: true });

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

      return interaction.editReply({
        content: `${EMOJI.ticket} Ticket zostal utworzony: ${channel}`
      });
    }

    // =========================
    // EXCHANGE MODAL SUBMIT
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "exchange_amount_modal") {
      const amount = interaction.fields.getTextInputValue("exchange_amount");
      const selection = pendingExchanges.get(interaction.user.id) || {};
      pendingExchanges.delete(interaction.user.id);
      const from = normalizeExchangeMethod(selection.from);
      const to = normalizeExchangeMethod(selection.to);
      const currency = normalizeCurrency(selection.currency);

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

      const exchange = `${rateMethod(from)}->${rateMethod(to)}`;
      const percent = rates[exchange];

      if (!percent) {
        return interaction.reply({
          content: `${EMOJI.warning} Nie mozna wymienic tej metody.`,
          ephemeral: true
        });
      }

      const calculated = calculateExchange(amount, from, to, currency);
      if (!calculated) {
        return interaction.reply({ content: `${EMOJI.warning} Nie można obliczyć tej wymiany.`, ephemeral: true });
      }
      const { amount: numericAmount, fee, afterFee } = calculated;
      const exchangePayload = { ...calculated, userId: interaction.user.id, createdAt: Date.now() };

      await interaction.deferReply({ ephemeral: true });

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

      const embed = buildExchangeEmbed(exchangePayload, interaction.user);

      exchangeData.set(channel.id, exchangePayload);

      await channel.send({
        content: `${interaction.user} <@&${REALIZATOR_ROLE_ID}>`,
        embeds: [embed],
        components: [ticketButtons()]
      });

      return interaction.editReply({
        content: `${EMOJI.ticket} Ticket został utworzony: ${channel}`
      });
    }


    // =========================
    // TICKET SETTINGS
    // =========================
    if (interaction.isButton() && interaction.customId === "ticket_settings") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.warning} Tylko realizator może zmieniać ustawienia ticketa.`, ephemeral: true });
      }
      if (String(interaction.channel.topic || "").split(":")[1] !== "exchange") {
        return interaction.reply({ content: `${EMOJI.warning} Ustawienia wymiany są dostępne tylko na ticketach wymiany.`, ephemeral: true });
      }
      return interaction.showModal(createTicketSettingsModal(interaction.channel));
    }

    if (interaction.isModalSubmit() && interaction.customId === "ticket_settings_modal") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.warning} Brak uprawnień.`, ephemeral: true });
      }
      const amount = interaction.fields.getTextInputValue("settings_amount").trim().replace(",", ".");
      const from = normalizeExchangeMethod(interaction.fields.getTextInputValue("settings_from"));
      const to = normalizeExchangeMethod(interaction.fields.getTextInputValue("settings_to"));
      const oldInfo = getExchangeInfoFromTicket(interaction.channel);
      const calculated = calculateExchange(amount, from, to, oldInfo.currency);
      if (!calculated) {
        return interaction.reply({ content: `${EMOJI.warning} Niepoprawna kwota/metoda albo brak prowizji dla tej pary.`, ephemeral: true });
      }
      const clientId = String(interaction.channel.topic || "").split(":")[0];
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.setTopic(`${clientId}:exchange:${calculated.amount}:${calculated.from}:${calculated.to}:${calculated.currency}`);
      const baseTicketName = `${calculated.from.toLowerCase()}-${calculated.to.toLowerCase()}-${interaction.channel.name.split("-").at(-1)}`;
      const nextTicketName = interaction.channel.name.startsWith("lock-")
        ? lockTicketName(baseTicketName)
        : unlockTicketName(baseTicketName);
      await interaction.channel.setName(nextTicketName).catch(() => {});
      exchangeData.set(interaction.channel.id, { ...calculated, userId: clientId, updatedAt: Date.now() });
      const edited = await syncTicketEmbeds(interaction.channel, calculated);
      return interaction.editReply(`${EMOJI.money} Zapisano ustawienia i zaktualizowano ${edited} wiadomości.`);
    }

    // =========================
    // /DANE
    // =========================
    if (interaction.isChatInputCommand() && interaction.commandName === "dane") {
      if (!interaction.member.roles.cache.has(REALIZATOR_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.warning} Tylko realizator może użyć /dane.`, ephemeral: true });
      }
      const parts = String(interaction.channel.topic || "").split(":");
      if (parts[1] !== "exchange") {
        return interaction.reply({ content: `${EMOJI.warning} Komenda działa wyłącznie na tickecie wymiany.`, ephemeral: true });
      }
      const method = getExchangeInfoFromTicket(interaction.channel).from;
      pendingPaymentData.set(`${interaction.channel.id}:${interaction.user.id}`, { method });
      return interaction.showModal(createPaymentDataModal(method));
    }

    if (interaction.isModalSubmit() && interaction.customId === "payment_data_modal") {
      const key = `${interaction.channel.id}:${interaction.user.id}`;
      const pending = pendingPaymentData.get(key);
      if (!pending) return interaction.reply({ content: `${EMOJI.warning} Formularz wygasł. Użyj ponownie /dane.`, ephemeral: true });
      pendingPaymentData.delete(key);
      const method = pending.method;
      const lines = [`**Exchanger:**`, `${interaction.user}`, ``, `**Metoda:**`, `${displayExchangeMethod(method)}`, ``];
      let copyText;
      if (isCryptoMethod(method)) {
        const address = interaction.fields.getTextInputValue("wallet_address").trim();
        lines.push(`**Adres ${displayExchangeMethod(method)}:**`, address);
        copyText = address;
      } else {
        const receiver = interaction.fields.getTextInputValue("payment_receiver").trim();
        const title = interaction.fields.getTextInputValue("payment_title").trim();
        const phone = interaction.fields.getTextInputValue("payment_phone").trim();
        lines.push(`**Odbiorca:**`, receiver, ``, `**Tytuł:**`, title, ``, `**Nr:**`, phone);
        copyText = `Odbiorca: ${receiver}\nTytuł: ${title}\nNr: ${phone}`;
      }
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle("🌟 StarX Exchange × DANE PŁATNOŚCI").setDescription(lines.join("\n")).setFooter({ text: "© 2026 StarX Exchange" })],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("copy_payment_data").setLabel("Kopiuj dane").setEmoji("📋").setStyle(ButtonStyle.Secondary))]
      });
      const sent = await interaction.fetchReply().catch(() => null);
      if (sent) pendingPaymentData.set(`message:${sent.id}`, { copyText });
      return;
    }

    if (interaction.isButton() && interaction.customId === "copy_payment_data") {
      const data = pendingPaymentData.get(`message:${interaction.message.id}`);
      if (!data) return interaction.reply({ content: `${EMOJI.warning} Nie udało się odczytać danych.`, ephemeral: true });
      return interaction.reply({ content: `\`\`\`text\n${data.copyText}\n\`\`\``, ephemeral: true });
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
    } catch (err) {
      console.error("TICKET INTERACTION ERROR:", err?.stack || err);
      const payload = {
        content: `${EMOJI.warning} Wystąpił błąd podczas obsługi ticketa. Spróbuj ponownie lub skontaktuj się z administracją.`,
        ephemeral: true
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

  client.on(Events.MessageCreate, async message => {
    try {
      if (message.author.bot || !message.guild || message.content.trim().toLowerCase() !== "sent") return;
      const parts = String(message.channel.topic || "").split(":");
      if (parts[1] !== "exchange") return;
      const claimedId = claimedTickets.get(message.channel.id);
      const exchanger = claimedId
        ? await message.guild.members.fetch(claimedId).then(m => m.user).catch(() => message.author)
        : message.author;
      await sendExchangeLegit(message.channel, exchanger, message);
    } catch (err) {
      console.error("AUTO SENT LEGIT ERROR:", err?.stack || err);
    }
  });
};
