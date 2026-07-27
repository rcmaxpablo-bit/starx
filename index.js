const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  Partials
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1499478004265517396";
const GUILD_ID = "1499481942394146946";
const OWNER_ROLE_ID = "1499499185337012377";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

client.setMaxListeners(30);
console.log("🚀 Uruchamianie StarX Exchange Bot...");

if (!TOKEN) {
  console.error("❌ Brak tokena!");
  process.exit(1);
}

const modules = [
  "./tickets",
  "./welcome",
  "./autolc",
  "./legit",
  "./opinie",
  "./kalkulator",
  "./obliczprowizje",
  "./cennik",
  "./regulamin",
  "./verify",
  "./propozycje",
  "./invites",
  "./lc",
  "./giveaway",
  "./przejmij",
  "./customerLegitSystem"
];

for (const mod of modules) {
  try {
    require(mod)(client);
    console.log(`✅ Moduł załadowany: ${mod}`);
  } catch (err) {
    console.error(`❌ Błąd modułu ${mod}:`, err?.stack || err);
  }
}

client.once(Events.ClientReady, async () => {
  try {
    console.log(`✅ Zalogowano jako ${client.user.tag}`);

    const commands = [
      new SlashCommandBuilder()
        .setName("reset")
        .setDescription("Restartuje bota")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
        .setName("panelklienta")
        .setDescription("Wyślij ponownie Panel Klienta")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Sprawdź swoje zaproszenia"),

      new SlashCommandBuilder()
        .setName("topinvites")
        .setDescription("Ranking zaproszeń"),

      new SlashCommandBuilder()
        .setName("myinvite")
        .setDescription("Twój link zaproszenia"),

      new SlashCommandBuilder()
        .setName("checkinvites")
        .setDescription("Sprawdź zaproszenia użytkownika")
        .addUserOption(option =>
          option
            .setName("osoba")
            .setDescription("Użytkownik")
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("testinvite")
        .setDescription("Dodaj testowe zaproszenia")
        .addUserOption(option =>
          option
            .setName("osoba")
            .setDescription("Użytkownik")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("ilosc")
            .setDescription("Ilość")
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("lc")
        .setDescription("Legit check template"),

      new SlashCommandBuilder()
        .setName("dane")
        .setDescription("Wyślij dane płatności na tickecie"),

      new SlashCommandBuilder()
        .setName("przejmij")
        .setDescription("Przejmij ticket")
        .addUserOption(option =>
          option
            .setName("uzytkownik")
            .setDescription("Klient")
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("odprzyjmij")
        .setDescription("Oddaj ticket"),

      new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Stwórz giveaway")
        .addStringOption(option =>
          option
            .setName("nagroda")
            .setDescription("Nagroda")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("czas")
            .setDescription("Np. 10m / 1h / 1d")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("winnerzy")
            .setDescription("Ilość winnerów")
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName("rola")
            .setDescription("Wymagana rola")
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName("bonus")
            .setDescription("Bonusowe losy")
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName("uczestnicy")
        .setDescription("Sprawdź kto bierze udział w giveaway")
        .addStringOption(option =>
          option
            .setName("id")
            .setDescription("ID giveaway")
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("autolc")
        .setDescription("Automatyczne LC przez webhook")
        .addUserOption(option =>
          option
            .setName("uzytkownik")
            .setDescription("Za kogo wysłać")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("tekst")
            .setDescription("Treść legit check")
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("reroll")
        .setDescription("Reroll giveaway")
        .addStringOption(option =>
          option
            .setName("id")
            .setDescription("ID giveaway")
            .setRequired(true)
        )
    ].map(command => command.toJSON());

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash commands deployed");
  } catch (err) {
    console.error("❌ READY ERROR:", err?.stack || err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "reset") {
      if (!interaction.member.roles.cache.has(OWNER_ROLE_ID)) {
        return interaction.reply({
          content: "❌ Brak permisji.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔄 Restart bota...",
        ephemeral: true
      });

      setTimeout(() => process.exit(0), 1000);
    }
  } catch (err) {
    console.error("❌ Interaction error:", err?.stack || err);
  }
});

process.on("unhandledRejection", err => {
  console.error("❌ UnhandledRejection:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ UncaughtException:", err);
});

client.login(TOKEN);
