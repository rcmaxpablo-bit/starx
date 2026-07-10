const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

module.exports = (client) => {

    // =========================================
    // CONFIG
    // =========================================
    const VERIFY_CHANNEL_ID = "1499725942313058344";
    const VERIFIED_ROLE_ID = "1499521304146083954";

    // kanały do pinga po weryfikacji
    const PING_CHANNELS = [
        "1499512781861556314",
        "1499812157246669001",
        "1499902366843932763",
        "1499513009188376767",
        "1499568863602540645",
        "1499573020321124412",
        "1500261480212205629"
    ];

    // =========================================
    // CUSTOM EMOJIS
    // =========================================
    const EMOJIS = {
        verify: "<a:verify:1499784353012514917>",
        shield: "<:shield:1501989271077388500>",
        pin: "<:pin:1501697389050986546>"
    };

    // przechowywanie odpowiedzi
    const challenges = new Map();

    // =========================================
    // GENEROWANIE DZIAŁANIA
    // =========================================
    function generateMath() {

        const isAdd = Math.random() > 0.5;

        // DODAWANIE
        if (isAdd) {

            const a = Math.floor(Math.random() * 16);
            const b = Math.floor(Math.random() * (31 - a));

            return {
                question: `🟢 ${a} + ${b}`,
                answer: a + b
            };
        }

        // ODEJMOWANIE
        const a = Math.floor(Math.random() * 31);
        const b = Math.floor(Math.random() * (a + 1));

        return {
            question: `🔴 ${a} − ${b}`,
            answer: a - b
        };
    }

    // =========================================
    // TWORZENIE MENU
    // =========================================
    function createMenu() {

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("verify_select")
                .setPlaceholder("Kliknij aby się zweryfikować")
                .addOptions([
                    {
                        label: "Zweryfikuj się",
                        description: "Rozwiąż działanie matematyczne",
                        value: "math",
                        emoji: {
                            id: "1499784353012514917",
                            animated: true
                        }
                    }
                ])
        );
    }

    // =========================================
    // PANEL
    // =========================================
    async function sendPanel() {

        const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#1b2dff')
            .setTitle(`${EMOJIS.shield}・Weryfikacja`)
            .setDescription(
                [
                    `> ${EMOJIS.pin} Kliknij menu poniżej`,
                    `> ${EMOJIS.verify} Rozwiąż proste działanie matematyczne`,
                    `> ${EMOJIS.shield} Odbierz dostęp do serwera`
                ].join("\n")
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({
                text: "System zabezpieczeń serwera"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed],
            components: [createMenu()]
        });
    }

    // =========================================
    // READY
    // =========================================
    client.once(Events.ClientReady, async () => {

        console.log(`${client.user.tag} online`);

        await sendPanel();
    });

    // =========================================
    // INTERAKCJE
    // =========================================
    client.on(Events.InteractionCreate, async (interaction) => {

        // =====================================
        // SELECT MENU
        // =====================================
        if (interaction.isStringSelectMenu()) {

            if (interaction.customId !== "verify_select") return;

            const math = generateMath();

            challenges.set(interaction.user.id, math.answer);

            const modal = new ModalBuilder()
                .setCustomId("math_modal")
                .setTitle("Weryfikacja");

            const input = new TextInputBuilder()
                .setCustomId("math_answer")
                .setLabel(`Ile to: ${math.question} ?`)
                .setPlaceholder("Wpisz poprawny wynik")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(3);

            const row = new ActionRowBuilder().addComponents(input);

            modal.addComponents(row);

            await interaction.showModal(modal);

            // =================================
            // RESET SELECT MENU
            // =================================
            setTimeout(async () => {

                await interaction.message.edit({
                    components: [createMenu()]
                }).catch(() => {});

            }, 500);
        }

        // =====================================
        // MODAL SUBMIT
        // =====================================
        if (interaction.isModalSubmit()) {

            if (interaction.customId !== "math_modal") return;

            const userAnswer = interaction.fields.getTextInputValue("math_answer");
            const correctAnswer = challenges.get(interaction.user.id);

            // =================================
            // POPRAWNA ODPOWIEDŹ
            // =================================
            if (Number(userAnswer) === correctAnswer) {

                challenges.delete(interaction.user.id);

                const member = await interaction.guild.members.fetch(interaction.user.id);

                // dodanie roli
                await member.roles.add(VERIFIED_ROLE_ID);

                // =================================
                // PING NA KANAŁACH
                // =================================
                for (const channelId of PING_CHANNELS) {

                    try {

                        const channel = await client.channels.fetch(channelId);

                        if (!channel) continue;

                        const message = await channel.send({
                            content: `${interaction.user}`
                        });

                        // usuń po 1 sekundzie
                        setTimeout(async () => {
                            await message.delete().catch(() => {});
                        }, 1000);

                    } catch (err) {
                        console.log(`Błąd kanału ${channelId}:`, err.message);
                    }
                }

                // =================================
                // SUKCES
                // =================================
                const successEmbed = new EmbedBuilder()
                    .setColor('#1b2dff')
                    .setDescription(
                        `${EMOJIS.verify} **Pomyślnie przeszedłeś weryfikację!**`
                    );

                await interaction.reply({
                    embeds: [successEmbed],
                    ephemeral: true
                });

            } else {

                // =================================
                // BŁĘDNA ODPOWIEDŹ
                // =================================
                const errorEmbed = new EmbedBuilder()
                    .setColor('#1b2dff')
                    .setDescription(
                        "❌ **Błędna odpowiedź! Spróbuj ponownie.**"
                    );

                await interaction.reply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }
        }
    });
};
