// invites.js STARX EXCHANGE V6 FINAL + DISCOUNT ROLES + OWNER TEST

const {
  EmbedBuilder,
  Events
} = require("discord.js");
const store = require("./dataStore");

module.exports = (client) => {

  const inviteCache = new Map();
  const personalInvites = new Map();

  // ==========================
  // CONFIG
  // ==========================
  const LOG_CHANNEL_ID = "1500261480212205629";

  const ROLE_5 = "1500270028635771032";   // -5%
  const ROLE_10 = "1500270005646786670";  // -10%

  const OWNER_ROLE_ID = "1499499185337012377";

  // ==========================
  // IMPORT STARYCH LOGÓW
  // ==========================
  function parseInviteLogMessage(message) {
    const parts = [message.content || ""];

    for (const embed of message.embeds || []) {
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      for (const field of embed.fields || []) {
        parts.push(field.name || "", field.value || "");
      }
    }

    const text = parts.join("\n");
    if (!/zaprosi[łl]|zaproszenie|invites?/i.test(text)) return null;

    const inviterMatch = text.match(/zaprosi[łl]\s*:?\s*<@!?(\d{17,20})>/i)
      || text.match(/inviter\s*:?\s*<@!?(\d{17,20})>/i);
    if (!inviterMatch) return null;

    const totalMatch = text.match(/(?:łącznie\s+zaproszeń|zaproszeń\s+łącznie|total\s+invites?)\s*:?\s*\*{0,2}(\d+)\*{0,2}/i);

    return {
      inviterId: inviterMatch[1],
      total: totalMatch ? Number(totalMatch[1]) : null
    };
  }

  async function importInviteMessage(message) {
    if (!message || message.channelId !== LOG_CHANNEL_ID || !message.guildId) return false;

    const parsed = parseInviteLogMessage(message);
    if (!parsed) return false;

    const result = store.importInviteLog({
      guildId: message.guildId,
      messageId: message.id,
      inviterId: parsed.inviterId,
      total: parsed.total
    });

    if (result.imported) {
      const member = await message.guild.members.fetch(parsed.inviterId).catch(() => null);
      await updateRewardRoles(member, result.total);
      console.log(`✅ Zaimportowano zaproszenia ${parsed.inviterId}: ${result.total}`);
    }

    return result.imported;
  }

  async function scanInviteHistory() {
    for (const guild of client.guilds.cache.values()) {
      const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (!channel || !channel.isTextBased() || !channel.messages) {
        console.log(`❌ Nie znaleziono kanału logów zaproszeń: ${LOG_CHANNEL_ID}`);
        continue;
      }

      let before;
      let scanned = 0;
      let imported = 0;

      while (true) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(error => {
          console.log("❌ Błąd pobierania historii zaproszeń:", error.message || error);
          return null;
        });

        if (!batch || batch.size === 0) break;
        const ordered = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        for (const message of ordered) {
          scanned += 1;
          if (await importInviteMessage(message)) imported += 1;
        }

        before = batch.last().id;
        if (batch.size < 100) break;
      }

      console.log(`✅ Historia zaproszeń: sprawdzono ${scanned}, dodano ${imported}.`);
    }
  }

  // ==========================
  // READY
  // ==========================
  client.once(Events.ClientReady, async () => {

    try {

      for (const guild of client.guilds.cache.values()) {

        const invites = await guild.invites.fetch();

        inviteCache.set(
          guild.id,
          new Map(invites.map(inv => [inv.code, inv.uses]))
        );
      }

      console.log("✅ Invite system loaded");
      await scanInviteHistory();

    } catch (err) {

      console.log("❌ Invite Ready Error:", err);
    }
  });

  // ==========================
  // NAGRODY RANG
  // ==========================
  async function updateRewardRoles(member, total) {

    if (!member) return;

    // 20+ = -10%
    if (total >= 20) {

      await member.roles.add(ROLE_10).catch(() => {});
      await member.roles.remove(ROLE_5).catch(() => {});

      return;
    }

    // 10+ = -5%
    if (total >= 10) {

      await member.roles.add(ROLE_5).catch(() => {});
      await member.roles.remove(ROLE_10).catch(() => {});

      return;
    }

    // mniej niż 10
    await member.roles.remove(ROLE_5).catch(() => {});
    await member.roles.remove(ROLE_10).catch(() => {});
  }

  // ==========================
  // JOIN TRACKER
  // ==========================
  client.on(Events.GuildMemberAdd, async member => {

    try {

      const guild = member.guild;

      const oldInvites =
        inviteCache.get(guild.id) || new Map();

      const newInvites =
        await guild.invites.fetch();

      const usedInvite = newInvites.find(inv => {

        const oldUses =
          oldInvites.get(inv.code) || 0;

        return inv.uses > oldUses;
      });

      inviteCache.set(
        guild.id,
        new Map(newInvites.map(inv => [inv.code, inv.uses]))
      );

      if (!usedInvite) return;

      let ownerId = null;

      if (personalInvites.has(usedInvite.code)) {

        ownerId =
          personalInvites.get(usedInvite.code);

      } else if (usedInvite.inviter) {

        ownerId =
          usedInvite.inviter.id;
      }

      if (!ownerId) return;

      const total = store.addInviteCount(guild.id, ownerId, 1);

      const inviterMember =
        await guild.members
          .fetch(ownerId)
          .catch(() => null);

      await updateRewardRoles(inviterMember, total);

      // ======================
      // LOG
      // ======================
      const logChannel =
        await guild.channels
          .fetch(LOG_CHANNEL_ID)
          .catch(() => null);

      if (logChannel) {

        const inviter =
          await client.users
            .fetch(ownerId)
            .catch(() => null);

        const embed = new EmbedBuilder()
          .setColor("#1b2dff")
          .setTitle("🌟 StarX Exchange » NOWE ZAPROSZENIE")
          .setDescription(
`👤 **Nowy użytkownik:** ${member}

📨 **Zaprosił:** ${inviter}

📈 **Łącznie zaproszeń:** **${total}**

🎁 **Nagrody:**
10 osób = <@&${ROLE_5}>
20 osób = <@&${ROLE_10}>

⚠️ Promocja działa wyłącznie na zakup kont i nie obejmuje exchange.

🔗 Kod: \`${usedInvite.code}\``
          )
          .setFooter({
            text: "Komendy: /invites • /myinvite • /topinvites • /checkinvites"
          })
          .setTimestamp();

        await logChannel.send({
          embeds: [embed]
        });
      }

    } catch (err) {

      console.log("❌ Join Invite Error:", err);
    }
  });

  // Zapisuj również nowe logi pojawiające się na kanale zaproszeń.
  client.on(Events.MessageCreate, async message => {
    try {
      await importInviteMessage(message);
    } catch (err) {
      console.log("❌ Invite Log Import Error:", err);
    }
  });

  // ==========================
  // COMMANDS
  // ==========================
  client.on(Events.InteractionCreate, async interaction => {

    try {

      if (!interaction.isChatInputCommand()) return;

      // ======================
      // /myinvite
      // ======================
      if (interaction.commandName === "myinvite") {

        const invite =
          await interaction.channel.createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: true
          });

        personalInvites.set(
          invite.code,
          interaction.user.id
        );

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1b2dff")
              .setTitle("🌟 StarX Exchange » TWÓJ LINK")
              .setDescription(
`👤 ${interaction.user}

📨 Twój link:

https://discord.gg/${invite.code}`
              )
          ],
          flags: 64
        });
      }

      // ======================
      // /invites
      // ======================
      if (interaction.commandName === "invites") {

        const amount = store.getInviteCount(interaction.guild.id, interaction.user.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1b2dff")
              .setTitle("🌟 StarX Exchange » INVITES")
              .setDescription(
`👤 ${interaction.user}

Zaprosiłeś **${amount}** osób.

⚠️ Promocja działa wyłącznie na zakup kont i nie obejmuje exchange.`
              )
          ],
          flags: 64
        });
      }

      // ======================
      // /checkinvites
      // ======================
      if (interaction.commandName === "checkinvites") {

        const user =
          interaction.options.getUser("osoba");

        const amount = store.getInviteCount(interaction.guild.id, user.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1b2dff")
              .setTitle("🌟 StarX Exchange » CHECK INVITES")
              .setDescription(
`👤 ${user}

Posiada **${amount}** zaproszeń.`
              )
          ],
          flags: 64
        });
      }

      // ======================
      // /topinvites
      // ======================
      if (interaction.commandName === "topinvites") {

        const members =
          interaction.guild.members.cache
            .filter(m => !m.user.bot)
            .map(m => ({
              user: m.user,
              invites: store.getInviteCount(interaction.guild.id, m.id)
            }));

        const sorted = members
          .filter(x => x.invites > 0)
          .sort((a, b) => b.invites - a.invites)
          .slice(0, 10);

        let desc = "";

        sorted.forEach((x, i) => {

          desc +=
            `**${i + 1}.** ${x.user} — **${x.invites} osób**\n`;
        });

        if (!desc) {
          desc = "Brak danych.";
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1b2dff")
              .setTitle("🌟 StarX Exchange » TOP INVITES")
              .setDescription(desc)
          ]
        });
      }

      // ======================
      // /testinvite OWNER ONLY
      // ======================
      if (interaction.commandName === "testinvite") {

        if (
          !interaction.member.roles.cache.has(
            OWNER_ROLE_ID
          )
        ) {

          return interaction.reply({
            content: "❌ Nie masz permisji.",
            flags: 64
          });
        }

        const user =
          interaction.options.getUser("osoba");

        const amount =
          interaction.options.getInteger("ilosc");

        const total = store.addInviteCount(interaction.guild.id, user.id, amount);

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        await updateRewardRoles(member, total);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1b2dff")
              .setTitle("🌟 StarX Exchange » TEST INVITE")
              .setDescription(
`Dodano **${amount}** zaproszeń użytkownikowi ${user}

📈 Aktualnie ma **${total}** zaproszeń.`
              )
          ],
          flags: 64
        });
      }

    } catch (err) {

      console.log("❌ Invite Command Error:", err);
    }
  });

};
