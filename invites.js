// invites.js STARX EXCHANGE V6 FINAL + DISCOUNT ROLES + OWNER TEST

const {
  EmbedBuilder,
  Events
} = require("discord.js");

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

      const key =
        `invites_${guild.id}_${ownerId}`;

      client[key] =
        (client[key] || 0) + 1;

      const total = client[key];

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

        const amount =
          client[
            `invites_${interaction.guild.id}_${interaction.user.id}`
          ] || 0;

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

        const amount =
          client[
            `invites_${interaction.guild.id}_${user.id}`
          ] || 0;

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
              invites:
                client[
                  `invites_${interaction.guild.id}_${m.id}`
                ] || 0
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

        const key =
          `invites_${interaction.guild.id}_${user.id}`;

        client[key] =
          (client[key] || 0) + amount;

        const total = client[key];

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
