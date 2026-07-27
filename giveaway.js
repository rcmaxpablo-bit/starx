// =====================================
// GIVEAWAY SYSTEM FINAL FIXED
// =====================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

module.exports = (client) => {

    // =====================================
    // CONFIG
    // =====================================

    const GIVEAWAY_CHANNEL_ID =
        "1502022020487970948";

    const DATA_DIR = path.join(__dirname, "data");
    const DATA_FILE = path.join(DATA_DIR, "giveaways.json");
    const LEGACY_DATA_FILE = path.join(__dirname, "giveaways.json");

    // =====================================
    // EMOJI
    // =====================================

    const EMOJI = {

        ticket:
            "<:TICKET:1501697124734206032>",

        pin:
            "<:PIN:1501697389050986546>",

        zap:
            "<:PIORUN:1501697151737139350>",

        lock:
            "<:ZAMKNIETE:1501697222901895258>",

        warning:
            "<:PILNE:1501693444030992395>",

        admin:
            "<:ADM:1501989271077388500>",

        clock:
            "<:CZAS:1502030015943151868>",

        arrow:
            "<a:Arrow_White:1508094625984811038>",

        nitro:
            "<a:nitro:1501684762601848963>",

        confetti:
            "<:confetti:1502025560606507048>",

        green:
            "<a:yes:1499784353012514917>",

        red:
            "<a:no:1499784378992295956>"
    };

    // =====================================
    // DATABASE
    // =====================================

    let giveaways = {};

    function saveData() {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const temporaryFile = `${DATA_FILE}.tmp`;
        fs.writeFileSync(temporaryFile, JSON.stringify(giveaways, null, 2), "utf8");
        fs.renameSync(temporaryFile, DATA_FILE);
    }

    function loadData() {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(DATA_FILE) && fs.existsSync(LEGACY_DATA_FILE)) {
            fs.copyFileSync(LEGACY_DATA_FILE, DATA_FILE);
        }
        if (!fs.existsSync(DATA_FILE)) saveData();

        try {
            const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
            giveaways = parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
        } catch (error) {
            console.error("❌ Nie udało się odczytać giveaways.json, zachowuję uszkodzoną kopię:", error.message);
            fs.copyFileSync(DATA_FILE, `${DATA_FILE}.broken-${Date.now()}`);
            giveaways = {};
            saveData();
        }
    }

    loadData();

    // =====================================
    // READY
    // =====================================

    client.once(
        Events.ClientReady,
        async () => {

            console.log(
                "✅ Giveaway loaded"
            );

            startChecker();
        }
    );

    // =====================================
    // TIME PARSER
    // =====================================

    function parseTime(time) {
        const normalized = String(time || "").trim().toLowerCase();
        const value = parseInt(normalized, 10);
        if (!Number.isFinite(value) || value <= 0) return null;

        if (normalized.endsWith("m"))
            return value * 60000;

        if (normalized.endsWith("h"))
            return value * 3600000;

        if (normalized.endsWith("d"))
            return value * 86400000;

        return null;
    }

    function pickWinner(giveaway) {
        if (!giveaway?.entries?.length) return null;
        const users = [];
        const bonus = Math.max(0, Number(giveaway.bonus) || 0);
        for (const userId of giveaway.entries) {
            for (let entry = 0; entry <= bonus; entry += 1) users.push(userId);
        }
        return users[Math.floor(Math.random() * users.length)] || null;
    }

    // =====================================
    // UPDATE EMBED
    // =====================================

    async function updateGiveawayMessage(id) {

        const g =
            giveaways[id];

        if (!g) return;

        const channel =
            await client.channels.fetch(
                g.channelId
            ).catch(() => null);

        if (!channel) return;

        const msg =
            await channel.messages.fetch(
                g.messageId
            ).catch(() => null);

        if (!msg) return;

        const embed =
            new EmbedBuilder()

                .setColor(
                    "#0f1014"
                )

                .setTitle(
                    `${EMOJI.nitro} PREMIUM GIVEAWAY`
                )

                .setDescription(
`${EMOJI.pin} **Nagroda**
> ${g.reward}

${EMOJI.admin} **Winnerzy**
> ${g.winners}

${EMOJI.clock} **Koniec**
> <t:${Math.floor(g.endAt / 1000)}:R>

${EMOJI.lock} **Rola**
> ${g.roleId ? `<@&${g.roleId}>` : "Brak"}

${EMOJI.zap} **Bonus Entries**
> +${g.bonus}

${EMOJI.ticket} **Uczestnicy**
> ${g.entries.length}

━━━━━━━━━━━━━━━━━━━━━━━

${EMOJI.arrow} Kliknij przycisk poniżej aby dołączyć.
`
                )

                .setImage(
                    "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand"
                )

                .setFooter({

                    text:
                        `Giveaway ID: ${id}`
                });

        const row =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            `join_${id}`
                        )

                        .setLabel(
                            "DOŁĄCZ"
                        )

                        .setEmoji("🎉")

                        .setStyle(
                            ButtonStyle.Success
                        )
                );

        await msg.edit({

            embeds: [embed],
            components: [row]
        });
    }

    // =====================================
    // AUTO END
    // =====================================

    function startChecker() {

        setInterval(async () => {

            for (const id in giveaways) {

                const g =
                    giveaways[id];

                if (g.ended)
                    continue;

                if (
                    Date.now() >=
                    g.endAt
                ) {

                    await endGiveaway(id);
                }
            }

        }, 5000);
    }

    // =====================================
    // END GIVEAWAY
    // =====================================

    async function endGiveaway(id) {

        const g =
            giveaways[id];

        if (!g) return;

        g.ended = true;

        saveData();

        const channel =
            await client.channels.fetch(
                g.channelId
            ).catch(() => null);

        if (!channel) return;

        const msg =
            await channel.messages.fetch(
                g.messageId
            ).catch(() => null);

        if (!msg) return;

        let users = [];

        for (const userId of g.entries) {

            users.push(userId);

            for (
                let i = 0;
                i < g.bonus;
                i++
            ) {

                users.push(userId);
            }
        }

        if (!users.length) {

            return channel.send({

                content:
                    `${EMOJI.red} Brak uczestników`
            });
        }

        const winners = [];

        while (
            winners.length <
            g.winners &&
            users.length > 0
        ) {

            const random =
                users[
                    Math.floor(
                        Math.random() *
                        users.length
                    )
                ];

            if (
                !winners.includes(
                    random
                )
            ) {

                winners.push(random);
            }

            users =
                users.filter(
                    x => x !== random
                );
        }

        const embed =
            new EmbedBuilder()

                .setColor('#1b2dff')

                .setTitle(
                    `${EMOJI.confetti} GIVEAWAY ZAKOŃCZONY`
                )

                .setDescription(
`${EMOJI.pin} **Nagroda**
> ${g.reward}

${EMOJI.admin} **Winnerzy**
> ${winners.map(x => `<@${x}>`).join(", ")}

${EMOJI.ticket} **Uczestnicy**
> ${g.entries.length}

${EMOJI.clock} **Koniec**
> <t:${Math.floor(Date.now() / 1000)}:R>

${EMOJI.ticket} **ID**
> \`${id}\`
`
                )

                .setImage(
                    "https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand"
                );

        const row =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            `reroll_${id}`
                        )

                        .setLabel(
                            "REROLL"
                        )

                        .setEmoji("🔄")

                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        await msg.edit({

            embeds: [embed],
            components: [row]
        });

        await channel.send({

            content:
                `${EMOJI.confetti} Gratulacje ${winners.map(x => `<@${x}>`).join(", ")}`
        });
    }

    // =====================================
    // INTERACTIONS
    // =====================================

    client.on(
        Events.InteractionCreate,
        async interaction => {

            // =====================================
            // CREATE GIVEAWAY
            // =====================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "giveaway"
            ) {

                const reward =
                    interaction.options.getString(
                        "nagroda"
                    );

                const time =
                    interaction.options.getString(
                        "czas"
                    );

                const winners =
                    interaction.options.getInteger(
                        "winnerzy"
                    );

                const role =
                    interaction.options.getRole(
                        "rola"
                    );

                const bonus =
                    interaction.options.getInteger(
                        "bonus"
                    ) || 0;

                const ms =
                    parseTime(time);

                if (!ms) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Zły format czasu`,

                        ephemeral: true
                    });
                }

                const id =
                    Date.now().toString();

                const endAt =
                    Date.now() + ms;

                const channel =
                    await client.channels.fetch(
                        GIVEAWAY_CHANNEL_ID
                    );

                const msg =
                    await channel.send({

                        content:
                            `${EMOJI.confetti} Tworzenie giveaway...`
                    });

                giveaways[id] = {

                    reward,
                    winners,

                    roleId:
                        role
                            ? role.id
                            : null,

                    bonus,

                    entries: [],

                    messageId:
                        msg.id,

                    channelId:
                        channel.id,

                    endAt,

                    ended: false
                };

                saveData();

                await updateGiveawayMessage(id);

                return interaction.reply({

                    content:
                        `${EMOJI.green} Giveaway utworzony`,

                    ephemeral: true
                });
            }

            // =====================================
            // JOIN BUTTON
            // =====================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "join_"
                )
            ) {

                const id =
                    interaction.customId.split("_")[1];

                const g =
                    giveaways[id];

                if (!g) return;

                if (g.ended) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Giveaway zakończony`,

                        ephemeral: true
                    });
                }

                if (
                    g.roleId &&
                    !interaction.member.roles.cache.has(
                        g.roleId
                    )
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Nie posiadasz wymaganej roli`,

                        ephemeral: true
                    });
                }

                if (
                    g.entries.includes(
                        interaction.user.id
                    )
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJI.warning} Już bierzesz udział`,

                        ephemeral: true
                    });
                }

                g.entries.push(
                    interaction.user.id
                );

                saveData();

                await updateGiveawayMessage(id);

                return interaction.reply({

                    content:
                        `${EMOJI.green} Dołączono do giveaway`,

                    ephemeral: true
                });
            }


            // =====================================
            // UCZESTNICY GIVEAWAY
            // =====================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "uczestnicy"
            ) {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Brak permisji`,

                        ephemeral: true
                    });
                }

                const id =
                    interaction.options.getString(
                        "id"
                    );

                const g =
                    giveaways[id];

                if (!g) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Nie znaleziono giveaway o ID: \`${id}\``,

                        ephemeral: true
                    });
                }

                const uniqueEntries =
                    [...new Set(g.entries)];

                const list =
                    uniqueEntries.length
                        ? uniqueEntries.map((userId, index) => `${index + 1}. <@${userId}> \`${userId}\``).join("\\n")
                        : "Brak uczestników";

                const chunks = [];
                let current = "";

                for (const line of list.split("\\n")) {
                    if ((current + "\\n" + line).length > 3500) {
                        chunks.push(current);
                        current = line;
                    } else {
                        current += current ? "\\n" + line : line;
                    }
                }

                if (current) chunks.push(current);

                const embed =
                    new EmbedBuilder()
                        .setColor("#1b2dff")
                        .setTitle(`${EMOJI.ticket} UCZESTNICY GIVEAWAY`)
                        .setDescription(
`${EMOJI.pin} **Nagroda**
> ${g.reward}

${EMOJI.ticket} **ID**
> \`${id}\`

${EMOJI.zap} **Liczba uczestników**
> ${uniqueEntries.length}

${EMOJI.arrow} **Lista**
${chunks[0] || "Brak uczestników"}`
                        )
                        .setFooter({
                            text:
                                "© 2026 StarX Exchange x Giveaway"
                        });

                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });

                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({
                        content: chunks[i],
                        ephemeral: true
                    });
                }

                return;
            }

            // =====================================
            // REROLL BUTTON
            // =====================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName === "reroll"
            ) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: `${EMOJI.red} Brak permisji`,
                        ephemeral: true
                    });
                }

                const id = interaction.options.getString("id");
                const giveaway = giveaways[id];
                if (!giveaway) {
                    return interaction.reply({
                        content: `${EMOJI.red} Nie znaleziono giveaway o ID: \`${id}\``,
                        ephemeral: true
                    });
                }

                const winner = pickWinner(giveaway);
                if (!winner) {
                    return interaction.reply({
                        content: `${EMOJI.red} Brak uczestników`,
                        ephemeral: true
                    });
                }

                return interaction.reply({ content: `🔄 Nowy winner: <@${winner}>` });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "reroll_"
                )
            ) {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Brak permisji`,

                        ephemeral: true
                    });
                }

                const id =
                    interaction.customId.split("_")[1];

                const g =
                    giveaways[id];

                if (!g) return;

                const winner = pickWinner(g);

                if (!winner) {

                    return interaction.reply({

                        content:
                            `${EMOJI.red} Brak uczestników`,

                        ephemeral: true
                    });
                }

                return interaction.reply({

                    content:
                        `🔄 Nowy winner: <@${winner}>`
                });
            }
        }
    );
};
