const {
    Events,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = (client) => {

    const GIVEAWAY_CHANNEL_ID = "1502022020487970948";

    const EMOJI = {
        gift: "<:gift:1502025560606507048>",
        green: "<a:green:1501990166082879538>",
        red: "<a:red:1501989543182864535>"
    };

    // MUST BE SHARED WITH GIVEAWAY.JS
    const giveaways = global.giveaways || new Map();
    global.giveaways = giveaways;

    // =========================
    // REGISTER COMMAND
    // =========================
    client.once(Events.ClientReady, async () => {

        const commands = [
            new SlashCommandBuilder()
                .setName("reroll")
                .setDescription("Reroll giveaway")
                .addStringOption(o =>
                    o.setName("giveaway_id")
                        .setDescription("ID giveaway")
                        .setRequired(true)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ].map(c => c.toJSON());

        await client.application.commands.set(commands);

        console.log("✅ Reroll loaded");
    });

    // =========================
    // COMMAND LOGIC
    // =========================
    client.on(Events.InteractionCreate, async (interaction) => {

        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "reroll") return;

        try {

            const id = interaction.options.getString("giveaway_id");

            if (!id) {
                return interaction.reply({
                    content: `${EMOJI.red} Brak ID giveaway`,
                    ephemeral: true
                });
            }

            const g = giveaways.get(id);

            if (!g) {
                return interaction.reply({
                    content: `${EMOJI.red} Nie znaleziono giveaway`,
                    ephemeral: true
                });
            }

            const users = g.users ? [...g.users] : [];

            if (!users.length) {
                return interaction.reply({
                    content: `${EMOJI.red} Brak uczestników`,
                    ephemeral: true
                });
            }

            const winner = users[Math.floor(Math.random() * users.length)];

            const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID).catch(() => null);

            if (channel) {
                await channel.send(
                    `${EMOJI.gift} 🎉 Nowy winner (reroll): <@${winner}>`
                );
            }

            return interaction.reply({
                content: `${EMOJI.green} Reroll wykonany!\n🎉 Winner: <@${winner}>`,
                ephemeral: true
            });

        } catch (err) {
            console.log("REROLL ERROR:", err);

            return interaction.reply({
                content: "❌ Błąd rerolla",
                ephemeral: true
            });
        }
    });
};
