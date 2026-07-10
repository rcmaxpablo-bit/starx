const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
    StringSelectMenuOptionBuilder,
    Events
} = require("discord.js");

module.exports = (client) => {
    const CHANNEL_ID = "1499568863602540645";
    const SEPARATOR = "-----------------------";

    const EMOJI = {
        blik: "<:blik:1499784231608389742>",
        paypal: "<:paypal:1499784258091483236>",
        crypto: "<:crypto:1499784635201224724>",
        ltc: "<:ltc:1499784285211726014>",
        psc: "<:MYPSC:1519440223140970636>",
        skrill: "<:SKRILL:1519440276492521472>",
        money: "<a:money:1501685438103031920>",
        box: "<:box:1500243849535033577>",
        arrow: "<a:Arrow_White:1508094625984811038>"
    };

    const rates = {
        BLIK_PAYPAL: 2,
        BLIK_CRYPTO: 8,
        BLIK_LTC: 8,
        BLIK_SKRILL: 2,

        KODBLIK_PAYPAL: 6,
        KODBLIK_CRYPTO: 11,
        KODBLIK_LTC: 11,
        KODBLIK_SKRILL: 6,

        PSC_BLIK: 11,
        PSC_KODBLIK: 11,
        PSC_PAYPAL: 11,
        PSC_CRYPTO: 13,
        PSC_LTC: 13,
        PSC_SKRILL: 11,

        PAYPAL_BLIK: 9,
        PAYPAL_CRYPTO: 9,
        PAYPAL_LTC: 9,
        PAYPAL_SKRILL: 9,

        CRYPTO_BLIK: 4,
        CRYPTO_KODBLIK: 4,
        CRYPTO_PAYPAL: 4,
        CRYPTO_CRYPTO: 4,
        CRYPTO_LTC: 4,
        CRYPTO_SKRILL: 4,

        SKRILL_BLIK: 9,
        SKRILL_KODBLIK: 9,
        SKRILL_PAYPAL: 9,
        SKRILL_CRYPTO: 9,
        SKRILL_LTC: 9,

        LTC_BLIK: 4,
        LTC_KODBLIK: 4,
        LTC_PAYPAL: 4,
        LTC_CRYPTO: 4
    };

    function methodName(method) {
        if (method === "KODBLIK") return "KOD BLIK";
        return method;
    }

    function methodEmoji(method) {
        if (method === "BLIK" || method === "KODBLIK") return EMOJI.blik;
        if (method === "PAYPAL") return EMOJI.paypal;
        if (method === "CRYPTO") return EMOJI.crypto;
        if (method === "LTC") return EMOJI.ltc;
        if (method === "PSC") return EMOJI.psc;
        if (method === "SKRILL") return EMOJI.skrill;
        return EMOJI.money;
    }

    function methodOptions() {
        return [
            new StringSelectMenuOptionBuilder()
                .setLabel("BLIK")
                .setValue("BLIK")
                .setEmoji({ id: "1499784231608389742", name: "blik" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("KOD BLIK")
                .setValue("KODBLIK")
                .setEmoji({ id: "1499784231608389742", name: "blik" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("PSC")
                .setValue("PSC")
                .setEmoji({ id: "1519440223140970636", name: "MYPSC" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("PAYPAL")
                .setValue("PAYPAL")
                .setEmoji({ id: "1499784258091483236", name: "paypal" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("CRYPTO")
                .setValue("CRYPTO")
                .setEmoji({ id: "1499784635201224724", name: "crypto" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("SKRILL")
                .setValue("SKRILL")
                .setEmoji({ id: "1519440276492521472", name: "SKRILL" }),
            new StringSelectMenuOptionBuilder()
                .setLabel("LTC")
                .setValue("LTC")
                .setEmoji({ id: "1499784285211726014", name: "ltc" })
        ];
    }

    function getModalSelectValue(fields, customId) {
        const field = fields?.fields?.get(customId) || fields?.getField?.(customId);
        if (Array.isArray(field?.values) && field.values.length) return field.values[0];
        if (typeof field?.value === "string") return field.value;
        return "";
    }

    function createCalcModal(type) {
        const modal = new ModalBuilder()
            .setCustomId(`calc_modal_${type}`)
            .setTitle("Potrzebne informacje.");

        const amountInput = new TextInputBuilder()
            .setCustomId("amount")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Przyklad: 250")
            .setRequired(true);

        const amountLabel = new LabelBuilder()
            .setLabel("JAKA KWOTA:")
            .setTextInputComponent(amountInput);

        const fromSelect = new StringSelectMenuBuilder()
            .setCustomId("from")
            .setPlaceholder("Nie wybrales/as zadnej opcji.")
            .setRequired(true)
            .addOptions(methodOptions());

        const fromLabel = new LabelBuilder()
            .setLabel("Z CZEGO:")
            .setStringSelectMenuComponent(fromSelect);

        const toSelect = new StringSelectMenuBuilder()
            .setCustomId("to")
            .setPlaceholder("Nie wybrales/as zadnej opcji.")
            .setRequired(true)
            .addOptions(methodOptions());

        const toLabel = new LabelBuilder()
            .setLabel("NA CO:")
            .setStringSelectMenuComponent(toSelect);

        return modal.addLabelComponents(
            amountLabel,
            fromLabel,
            toLabel
        );
    }

    async function sendPanel() {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#1b2dff")
            .setTitle("StarX Exchange x KALKULATOR PROWIZJI")
            .setDescription([
                `${EMOJI.arrow} Jezeli chcesz obliczyc prowizje swojej wymiany, wybierz opcje ponizej.`,
                "",
                SEPARATOR,
                "",
                `${EMOJI.arrow} Minimalna prowizja wynosi: **3 PLN**`
            ].join("\n"))
            .setFooter({ text: "© 2026 StarX Exchange" });

        const menu = new StringSelectMenuBuilder()
            .setCustomId("calc_type")
            .setPlaceholder("Nie wybrales/as zadnej opcji.")
            .addOptions([
                {
                    label: "Jaka kwote otrzymam?",
                    value: "otrzymam",
                    emoji: { id: "1501685438103031920", name: "money", animated: true }
                },
                {
                    label: "Ile musze wplacic aby dostac X?",
                    value: "wplace",
                    emoji: { id: "1508094625984811038", name: "Arrow_White", animated: true }
                }
            ]);

        await channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)]
        });

        console.log("Kalkulator prowizji wyslany");
    }

    if (client.isReady()) {
        sendPanel();
    } else {
        client.once(Events.ClientReady, sendPanel);
    }

    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === "calc_type") {
            return interaction.showModal(createCalcModal(interaction.values[0]));
        }

        if (!interaction.isModalSubmit() || !interaction.customId.startsWith("calc_modal_")) return;

        const type = interaction.customId.replace("calc_modal_", "");
        const amount = parseFloat(
            interaction.fields
                .getTextInputValue("amount")
                .replace(",", ".")
        );
        const from = getModalSelectValue(interaction.fields, "from");
        const to = getModalSelectValue(interaction.fields, "to");
        const rateKey = `${from}_${to}`;
        const percent = rates[rateKey];

        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({
                content: "Podano nieprawidlowa kwote.",
                flags: 64
            });
        }

        if (!percent) {
            return interaction.reply({
                content: "Nie mozna wymienic tej metody.",
                flags: 64
            });
        }

        let fee = (amount * percent) / 100;
        if (fee < 3) fee = 3;

        const result = type === "otrzymam"
            ? amount - fee
            : amount + fee;

        const embed = new EmbedBuilder()
            .setColor("#1b2dff")
            .setTitle("StarX Exchange x WYNIK")
            .setDescription([
                `${methodEmoji(from)} **Z:** ${methodName(from)}`,
                "",
                `${methodEmoji(to)} **Na:** ${methodName(to)}`,
                "",
                `${EMOJI.money} **Prowizja:** ${percent}%`,
                `${EMOJI.arrow} **Minimalna prowizja:** 3 PLN`,
                "",
                SEPARATOR,
                "",
                `${EMOJI.money} **Wynik:** \`${result.toFixed(2)} PLN\``
            ].join("\n"))
            .setFooter({ text: "© 2026 StarX Exchange x Kalkulator" });

        return interaction.reply({
            embeds: [embed],
            flags: 64
        });
    });
};

