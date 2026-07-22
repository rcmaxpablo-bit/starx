const {
    Events,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require("discord.js");

module.exports = (client) => {

    // =====================================
    // CONFIG
    // =====================================
    const STAFF_ROLE_ID = "1500930428993933373";
    const CLIENT_ROLE_ID = "1499572498604363918";
    const REP_CHANNEL_ID = "1500893110048133253";

    // =====================================
    // EMOJI
    // =====================================
    const EMOJI = {

        ticket: "<:TICKET:1501697124734206032>",
        pin: "<:PIN:1501697389050986546>",
        zap: "<:PIORUN:1501697151737139350>",
        lock: "<:ZAMKNIETE:1501697222901895258>",
        warning: "<:PILNE:1501693444030992395>",
        support: "<:WSPARCIE:1500243961124618381>",
        admin: "<:ADM:1501989271077388500>",
        list: "<:LIST:1501693215328440370>",
        clock: "<:CZAS:1502030015943151868>",

        money: "<a:m_:1501685438103031920>",
        arrow: "<a:Arrow_White:1508094625984811038>",
        nitro: "<a:nitro:1501684762601848963>",

        blik: "<:blik:1499784231608389742>",
        paypal: "<:paypal:1499784258091483236>",
        crypto: "<:crypto:1499784635201224724>",
        ltc: "<:ltc:1499784285211726014>",

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

        nordvpn: "<:NORDVPN:1501999409343369400>",
        mullvad: "<:mullvad:1501999834159255712>",
        tunnelbear: "<:TUNNELBEARVPN:1502000450009042984>",

        middleman: "<:LUDZIE:1500243884733894716>",
        cart: "<:SKLEP:1500243849535033577>",
        box: "<:SKLEP:1500243849535033577>",

        prime: "<:primevideo:1502001410311716984>"
    };

    client.on(Events.InteractionCreate, async (interaction) => {

        try {

            // =====================================
            // /LC COMMAND
            // =====================================
            if (
                interaction.isChatInputCommand() &&
                interaction.commandName === "lc"
            ) {

                if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                    return interaction.reply({
                        content: `${EMOJI.warning} Nie masz permisji.`,
                        ephemeral: true
                    });
                }

                const menu =
                    new StringSelectMenuBuilder()
                        .setCustomId("lc_type")
                        .setPlaceholder("Wybierz typ legit check")
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel("Purchased")
                                .setDescription("Zakup produktu")
                                .setValue("purchased"),

                            new StringSelectMenuOptionBuilder()
                                .setLabel("Exchange")
                                .setDescription("Wymiana metod")
                                .setValue("exchange"),

                            new StringSelectMenuOptionBuilder()
                                .setLabel("Konkurs")
                                .setDescription("Legit konkurs")
                                .setValue("contest")
                        );

                const row = new ActionRowBuilder().addComponents(menu);

                return interaction.reply({
                    content: `${EMOJI.money} Wybierz typ legit check`,
                    components: [row],
                    ephemeral: true
                });
            }

            // =====================================
            // SELECT MENU
            // =====================================
            if (
                interaction.isStringSelectMenu() &&
                interaction.customId === "lc_type"
            ) {

                const type = interaction.values[0];

                if (type === "purchased") {

                    const modal =
                        new ModalBuilder()
                            .setCustomId("lc_purchased")
                            .setTitle("StarX Exchange • Purchased");

                    const product =
                        new TextInputBuilder()
                            .setCustomId("product")
                            .setLabel("Produkt")
                            .setPlaceholder("Netflix Premium")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const price =
                        new TextInputBuilder()
                            .setCustomId("price")
                            .setLabel("Kwota")
                            .setPlaceholder("20")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const payment =
                        new TextInputBuilder()
                            .setCustomId("payment")
                            .setLabel("Metoda płatności")
                            .setPlaceholder("BLIK")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(product),
                        new ActionRowBuilder().addComponents(price),
                        new ActionRowBuilder().addComponents(payment)
                    );

                    return interaction.showModal(modal);
                }

                if (type === "exchange") {

                    const modal =
                        new ModalBuilder()
                            .setCustomId("lc_exchange")
                            .setTitle("StarX Exchange • Exchange");

                    const from =
                        new TextInputBuilder()
                            .setCustomId("from")
                            .setLabel("Z czego")
                            .setPlaceholder("LTC")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const to =
                        new TextInputBuilder()
                            .setCustomId("to")
                            .setLabel("Na co")
                            .setPlaceholder("BLIK")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const amount =
                        new TextInputBuilder()
                            .setCustomId("amount")
                            .setLabel("Kwota")
                            .setPlaceholder("300")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(from),
                        new ActionRowBuilder().addComponents(to),
                        new ActionRowBuilder().addComponents(amount)
                    );

                    return interaction.showModal(modal);
                }

                if (type === "contest") {

                    const finalText =
                        `+rep ${interaction.user} konkurs`;

                    const embed =
                        new EmbedBuilder()
                            .setColor("#1b2dff")
                            .setTitle(`${EMOJI.money} StarX Exchange » Legit Check`)
                            .setDescription(
`${EMOJI.pin} **Legit utworzony**

${EMOJI.zap} \`\`\`
${finalText}
\`\`\`

${EMOJI.arrow} **Skopiuj wiadomość**
${EMOJI.arrow} **Wklej na <#${REP_CHANNEL_ID}>**`
                            )
                            .setFooter({ text: "© 2026 StarX Exchange" })
                            .setTimestamp();

                    await interaction.channel.send({ embeds: [embed] });

                    return interaction.reply({
                        content: `${EMOJI.money} Legit został wysłany.`,
                        ephemeral: true
                    });
                }
            }

            // =====================================
            // PURCHASED
            // =====================================
            if (interaction.isModalSubmit() && interaction.customId === "lc_purchased") {

                const product = interaction.fields.getTextInputValue("product");
                const price = interaction.fields.getTextInputValue("price");
                const payment = interaction.fields.getTextInputValue("payment");

                const finalText =
                    `+rep ${interaction.user} Purchased ${product} ${price}PLN [${payment}]`;

                const embed =
                    new EmbedBuilder()
                        .setColor("#1b2dff")
                        .setTitle(`${EMOJI.money} StarX Exchange » Legit Check`)
                        .setDescription(
`${EMOJI.pin} **Legit utworzony**

${EMOJI.zap} \`\`\`
${finalText}
\`\`\`

${EMOJI.arrow} **Skopiuj wiadomość**
${EMOJI.arrow} **Wklej na <#${REP_CHANNEL_ID}>**`
                        )
                        .setFooter({ text: "© 2026 StarX Exchange" })
                        .setTimestamp();

                await interaction.channel.send({ embeds: [embed] });

                return interaction.reply({
                    content: `${EMOJI.money} Legit został wysłany.`,
                    ephemeral: true
                });
            }

            // =====================================
            // EXCHANGE
            // =====================================
            if (interaction.isModalSubmit() && interaction.customId === "lc_exchange") {

                const from = interaction.fields.getTextInputValue("from");
                const to = interaction.fields.getTextInputValue("to");
                const amount = interaction.fields.getTextInputValue("amount");

                const finalText =
                    `+rep ${interaction.user} Exchange ${from} to ${to} ${amount}PLN`;

                const embed =
                    new EmbedBuilder()
                        .setColor("#1b2dff")
                        .setTitle(`${EMOJI.money} StarX Exchange » Legit Check`)
                        .setDescription(
`${EMOJI.pin} **Legit utworzony**

${EMOJI.zap} \`\`\`
${finalText}
\`\`\`

${EMOJI.arrow} **Skopiuj wiadomość**
${EMOJI.arrow} **Wklej na <#${REP_CHANNEL_ID}>**`
                        )
                        .setFooter({ text: "© 2026 StarX Exchange" })
                        .setTimestamp();

                await interaction.channel.send({ embeds: [embed] });

                return interaction.reply({
                    content: `${EMOJI.money} Legit został wysłany.`,
                    ephemeral: true
                });
            }

        } catch (err) {
            console.log("❌ LC ERROR:", err);
        }
    });

    // =====================================
    // REMOVE ACCESS AFTER REP MESSAGE
    // =====================================
    client.on(Events.MessageCreate, async (message) => {

        try {

            if (message.author.bot || message.webhookId) return;
            if (message.channel.id !== REP_CHANNEL_ID) return;
            if (!/^\+rep(?:\s|$)/i.test(String(message.content || "").trim())) return;

            const guild = message.guild;
            // Dostęp zabieramy autorowi +rep (klientowi), a nie oznaczonemu sprzedawcy.
            const clientId = message.author.id;

            const ticket = guild.channels.cache.find(c =>
                c.topic?.startsWith(clientId)
            );

            if (!ticket) return;

            await ticket.permissionOverwrites.edit(clientId, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            });

            // Realizator ma dalej dostęp do ticketa, bo jego osobny overwrite zostaje bez zmian.
            await ticket.send({
                content: `${EMOJI.lock} Dostęp klienta do ticketa został usunięty po wysłaniu legit checka.`
            });

        } catch (err) {
            console.log("AUTO REMOVE ERROR:", err);
        }
    });
};
