const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");
const { findPanelMessage, upsertPanel } = require("./panelManager");

module.exports = (client) => {

  const CHANNEL_ID = "1499519884860854505";

  let yesVotes = 19;
  let noVotes = 1;

  let legitMessageId = null;
  const votedUsers = new Set();

  // =====================
  // PANEL
  // =====================
  async function sendPanel() {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return;

      // Zachowaj aktualne liczniki głosów ze starego panelu po restarcie bota.
      const oldPanel = await findPanelMessage(channel, { customId: "legit_yes" });
      if (oldPanel) {
        const buttons = oldPanel.components.flatMap(row => row.components || []);
        const oldYes = buttons.find(button => button.customId === "legit_yes");
        const oldNo = buttons.find(button => button.customId === "legit_no");

        const parsedYes = Number(oldYes?.label);
        const parsedNo = Number(oldNo?.label);
        if (Number.isFinite(parsedYes)) yesVotes = parsedYes;
        if (Number.isFinite(parsedNo)) noVotes = parsedNo;
      }

      const embed = new EmbedBuilder()
        .setColor('#1b2dff')
        .setTitle("🌟 StarX Exchange » CZY JESTEŚMY LEGIT")
        .setDescription(
`<a:1499784353012514917:1499784353012514917> Jeśli uważasz, że **TAK**, kliknij przycisk poniżej.

<a:1499784378992295956:1499784378992295956> Jeśli uważasz, że **NIE**, kliknij przycisk poniżej.

⚠️ Oddanie głosu <a:1499784378992295956:1499784378992295956> bez dowodu i sensownego powodu może skutkować karą.`
        )
        .setImage("https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand")
        .setFooter({
          text: "© 2026 StarX Exchange x Legit Check"
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("legit_yes")
          .setEmoji("1499784353012514917")
          .setLabel(`${yesVotes}`)
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("legit_no")
          .setEmoji("1499784378992295956")
          .setLabel(`${noVotes}`)
          .setStyle(ButtonStyle.Secondary)
      );

      const msg = await upsertPanel(channel, {
        embeds: [embed],
        components: [row]
      }, { customId: "legit_yes" });

      legitMessageId = msg.id;

    } catch (err) {
      console.log(err);
    }
  }

  client.once(Events.ClientReady, async () => {
    await sendPanel();
  });

  // =====================
  // BUTTONY
  // =====================
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.message.id !== legitMessageId) return;

    if (votedUsers.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Już oddałeś głos.",
        flags: 64
      });
    }

    votedUsers.add(interaction.user.id);

    if (interaction.customId === "legit_yes") yesVotes++;
    if (interaction.customId === "legit_no") noVotes++;

    const embed = new EmbedBuilder()
      .setColor('#1b2dff')
      .setTitle("🌟 StarX Exchange » CZY JESTEŚMY LEGIT")
      .setDescription(
`<a:1499784353012514917:1499784353012514917> Jeśli uważasz, że **TAK**, kliknij przycisk poniżej.

<a:1499784378992295956:1499784378992295956> Jeśli uważasz, że **NIE**, kliknij przycisk poniżej.

⚠️ Oddanie głosu <a:1499784378992295956:1499784378992295956> bez dowodu i sensownego powodu może skutkować karą.`
      )
      .setImage("https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand")
      .setFooter({
        text: "© 2026 StarX Exchange x Legit Check"
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("legit_yes")
        .setEmoji("1499784353012514917")
        .setLabel(`${yesVotes}`)
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("legit_no")
        .setEmoji("1499784378992295956")
        .setLabel(`${noVotes}`)
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      embeds: [embed],
      components: [row]
    });
  });

};
