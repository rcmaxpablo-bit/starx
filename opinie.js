const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');
const { upsertPanel } = require('./panelManager');

const EMOJI = {
  // =========================
  // TICKETY / SYSTEM
  // =========================
  ticket: "<:TICKET:1501697124734206032>",
  pin: "<:PIN:1501697389050986546>",
  zap: "<:PIORUN:1501697151737139350>",
  lock: "<:ZAMKNIETE:1501697222901895258>",
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
  paypal: "<:paypal:1499784258091483236>",
  crypto: "<:crypto:1499784635201224724>",
  ltc: "<:ltc:1499784285211726014>",

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

module.exports = (client) => {

  const PANEL_CHANNEL_ID = "1499519935657935049";
  const OPINIE_CHANNEL_ID = "1499519935657935049";

  let panelMessage = null;

  // =====================
  // GWIAZDKI
  // =====================
  function stars(num) {
    return "⭐".repeat(num);
  }

  // =====================
  // PANEL
  // =====================
  async function sendPanel() {
    try {
      const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
      if (!channel) return console.log("❌ Nie znaleziono kanału opinii.");

      const embed = new EmbedBuilder()
        .setColor('#1b2dff')
        .setTitle(`${EMOJI.nitro} StarX Exchange » WYSTAW OPINIĘ`)
        .setDescription(
`${EMOJI.arrow} Wystawiając nam opinię pokazujesz innym, co zadowoliło Cię u nas.

${EMOJI.arrow} Będziemy mega wdzięczni za wystawienie nam opinii.

${EMOJI.pin} Opinię napiszesz klikając przycisk poniżej.`
        )
        .setFooter({ text: '© 2026 StarX Exchange x Wystaw Opinię' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('wystaw_opinie')
          .setLabel('Kliknij, aby wystawić opinię!')
          .setEmoji({ id: '1501697389050986546', name: 'PIN' })
          .setStyle(ButtonStyle.Primary)
      );

      panelMessage = await upsertPanel(channel, {
        embeds: [embed],
        components: [row]
      }, { customId: "wystaw_opinie" });

      console.log("✅ Panel opinii zaktualizowany.");

    } catch (err) {
      console.log("❌ Błąd panelu:", err);
    }
  }

  // =====================
  // READY
  // =====================
  client.on(Events.ClientReady, async () => {
    setTimeout(async () => {
      await sendPanel();
    }, 3000);
  });

  // =====================
  // INTERACTION
  // =====================
  client.on(Events.InteractionCreate, async interaction => {

    // BUTTON
    if (interaction.isButton()) {
      if (interaction.customId === "wystaw_opinie") {

        const modal = new ModalBuilder()
          .setCustomId('opinia_modal')
          .setTitle('Wystaw opinię');

        modal.addComponents(

          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('tresc')
              .setLabel('Treść opinii')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),

          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('poprawic')
              .setLabel('Co można byłoby poprawić?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
          ),

          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('czas')
              .setLabel('Czas realizacji 1-5')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),

          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('przebieg')
              .setLabel('Przebieg transakcji 1-5')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )

        );

        return interaction.showModal(modal);
      }
    }

    // MODAL
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "opinia_modal") {

        const tresc = interaction.fields.getTextInputValue('tresc');

        let poprawic = "Nic";
        try {
          poprawic = interaction.fields.getTextInputValue('poprawic') || "Nic";
        } catch {}

        const czas = Math.max(
          1,
          Math.min(5, parseInt(interaction.fields.getTextInputValue('czas')) || 1)
        );

        const przebieg = Math.max(
          1,
          Math.min(5, parseInt(interaction.fields.getTextInputValue('przebieg')) || 1)
        );

        const laczna = Math.round((czas + przebieg) / 2);

        const channel = await client.channels.fetch(OPINIE_CHANNEL_ID);

        const embed = new EmbedBuilder()
          .setColor('#1b2dff')
          .setTitle(`${EMOJI.nitro} StarX Exchange » NOWA OPINIA`)
          .setDescription(
`${EMOJI.middleman} **Twórca opinii:** ${interaction.user}

${EMOJI.arrow} **Treść opinii**
${tresc}

${EMOJI.list} **Co można poprawić**
${poprawic}

${EMOJI.clock} **Czas realizacji**
${stars(czas)}

${EMOJI.money} **Przebieg transakcji**
${stars(przebieg)}

${EMOJI.ticket} **Łączna opinia**
${stars(laczna)}`
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: '© 2026 StarX Exchange x Opinie Klientów' });

        await channel.send({
          embeds: [embed]
        });

        // Odśwież istniejący panel zamiast wysyłać kolejny.
        await sendPanel();

        await interaction.reply({
          content: `${EMOJI.ticket} Dziękujemy za opinię!`,
          ephemeral: true
        });
      }
    }

  });

};
