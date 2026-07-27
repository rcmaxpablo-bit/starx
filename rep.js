const { EmbedBuilder, Events } = require("discord.js");
const { upsertPanel } = require("./panelManager");

module.exports = (client) => {

  // =========================
  // CONFIG
  // =========================
  const CHANNEL_ID = "1500893110048133253"; // kanał rep
  const TARGET_ROLE_ID = "1499572498604363918";

  const LEGIT_CHANNEL_ID = "1499519884860854505";
  const OPINIE_CHANNEL_ID = "1499519935657935049";

  let panelMessage = null;

  // =========================
  // PANEL
  // =========================
  async function sendPanel(channel) {
    const embed = new EmbedBuilder()
      .setColor('#1b2dff')
      .setTitle("🌟 StarX Exchange × LEGIT CHECK")
      .setDescription(
`<a:nitro:1501684762601848963> Dziękujemy za wybranie **StarX Exchange**!

<:LIST:1501693215328440370> Twój legit check jest dla nas bardzo ważny i pomaga budować zaufanie.

<a:Arrow_White:1508094625984811038> **WZÓR LEGIT CHECKA**
\`\`\`md
+rep @seller Purchased [co] [kwota]PLN [metoda]
\`\`\`

<a:Arrow_White:1508094625984811038> **PRZYKŁAD**
\`\`\`md
+rep @jarek.svx Purchased Konto Stake 40PLN [BLIK]
\`\`\`

<:PIN:1501697389050986546> Po wystawieniu legit checka ticket zostanie automatycznie zamknięty.

© 2026 StarX Exchange`
      )
      .setFooter({ text: "StarX Exchange" });

    panelMessage = await upsertPanel(channel, { embeds: [embed] }, {
      embedTitle: "🌟 StarX Exchange × LEGIT CHECK"
    });
  }

  // =========================
  // READY
  // =========================
  client.once(Events.ClientReady, async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return console.log("❌ Nie znaleziono kanału rep");

      await sendPanel(channel);

      console.log("✅ Rep panel uruchomiony");

    } catch (err) {
      console.log("❌ Rep Ready error:", err);
    }
  });

  // =========================
  // NOWE WIADOMOŚCI
  // =========================
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.channel.id !== CHANNEL_ID) return;
      if (message.author.bot) return;

      // NIE usuwamy wiadomości usera
      await sendPanel(message.channel);

    } catch (err) {
      console.log("❌ Rep Message error:", err);
    }
  });

  // Ping po nadaniu roli Klient jest obsługiwany w tickets.js przy wysyłaniu wiadomości LC,
  // żeby na kanale legit-check nie pojawiały się dwa pingi.

};
