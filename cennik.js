const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events,
  MessageFlags
} = require('discord.js');
const { upsertPanel } = require('./panelManager');

const CHANNEL_ID = '1499902366843932763';
const MENU_ID = 'starx_cennik';
const BLUE = 0xffd100;

const EMOJI = {
  spotify: '<:Spotify:1500238701718933627>',
  netflix: '<:Netflix:1500238788306403398>',
  youtube: '<:ytpremium:1500239415937859605>',
  hbo: '<:HBOmax:1500239251143524464>',
  nitro: '<a:nitro:1501684762601848963>',
  crunchyroll: '<:crunchyroll:1501686424158605463>',
  disney: '<:disney:1501686870025699449>',
  money: '<a:money:1501685438103031920>',
  pin: '<:pin:1501697389050986546>',
  zap: '<:zap:1501697151737139350>',
  lock: '<:lock:1501697222901895258>',
  prime: '<:primevideo:1502001410311716984>',
  chatgpt: '<:chatgpt:1502001751019094097>',
  capcut: '<:capcut:1502002116405887039>',
  nord: '<:nordvpn:1501999409343369400>',
  mullvad: '<:mullvad:1501999834159255712>',
  tunnel: '<:tunnelbear:1502000450009042984>',
  cda: '<:cda:1508077411873325076>'
};

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(BLUE)
    .setTitle('🌟 ︲ StarX Exchange × CENNIK')
    .setDescription([
      `> ${EMOJI.pin} **︲ Wybierz kategorię z menu poniżej.**`,
      '',
      `> ${EMOJI.zap} **︲ Szybka realizacja**`,
      `> ${EMOJI.lock} **︲ Bezpieczne transakcje**`,
      `> ${EMOJI.money} **︲ Najlepsze ceny**`
    ].join('\n'))
    .setImage('https://i.imgur.com/QYhsGEm_d.webp?maxwidth=760&fidelity=grand')
    .setFooter({ text: '© 2026 StarX Exchange' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(MENU_ID)
    .setPlaceholder('📦 Wybierz kategorię...')
    .addOptions(
      { label: 'NITRO', value: 'nitro', emoji: { id: '1501684762601848963', name: 'nitro' } },
      { label: 'STREAMING', value: 'streaming', emoji: { id: '1500238788306403398', name: 'Netflix' } },
      { label: 'VPN', value: 'vpn', emoji: { id: '1501999409343369400', name: 'nordvpn' } }
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function priceEmbed(category) {
  const embed = new EmbedBuilder().setColor(BLUE);

  if (category === 'nitro') {
    return embed
      .setTitle(`${EMOJI.nitro} StarX Exchange × NITRO`)
      .setDescription(`${EMOJI.nitro} **Nitro Boost (28 dni • Full Warranty)**\n${EMOJI.money} \`20 zł\``)
      .setFooter({ text: 'StarX Exchange • Najlepsze ceny' });
  }

  if (category === 'streaming') {
    return embed
      .setTitle(`${EMOJI.netflix} StarX Exchange × STREAMING`)
      .setDescription([
        [`${EMOJI.spotify} **Spotify Premium LIFETIME [KEY]**`, `${EMOJI.money} \`30 zł\``],
        [`${EMOJI.spotify} **Spotify Premium FA [LIFETIME]**`, `${EMOJI.money} \`20 zł\``],
        [`${EMOJI.youtube} **YT Premium FA [LIFETIME]**`, `${EMOJI.money} \`20 zł\``],
        [`${EMOJI.prime} **Prime Video 1 Month**`, `${EMOJI.money} \`20 zł\``],
        [`${EMOJI.chatgpt} **ChatGPT Plus FA 1 Month**`, `${EMOJI.money} \`40 zł\``],
        [`${EMOJI.capcut} **CapCut Pro FA [LIFETIME]**`, `${EMOJI.money} \`20 zł\``],
        [`${EMOJI.netflix} **Netflix Lifetime**`, `${EMOJI.money} \`20 zł\``],
        [`${EMOJI.hbo} **Max (HBO) Lifetime**`, `${EMOJI.money} \`10 zł\``],
        [`${EMOJI.disney} **Disney+ Lifetime**`, `${EMOJI.money} \`10 zł\``],
        [`${EMOJI.crunchyroll} **Crunchyroll Fan Lifetime**`, `${EMOJI.money} \`10 zł\``],
        [`${EMOJI.cda} **CDA Premium Lifetime**`, `${EMOJI.money} \`10 zł\``]
      ].map(lines => lines.join('\n')).join('\n\n'))
      .setFooter({ text: 'StarX Exchange • Najniższe ceny' });
  }

  if (category === 'vpn') {
    return embed
      .setTitle(`${EMOJI.nord} StarX Exchange × VPN`)
      .setDescription([
        `${EMOJI.nord} **NordVPN (Private) [LIFETIME]**\n${EMOJI.money} \`15 zł\``,
        `${EMOJI.mullvad} **Mullvad VPN [LIFETIME]**\n${EMOJI.money} \`40 zł\``,
        `${EMOJI.tunnel} **Tunnel Bear [VPN]**\n${EMOJI.money} \`20 zł\``
      ].join('\n\n'))
      .setFooter({ text: 'StarX Exchange • VPN Store' });
  }

  return null;
}

module.exports = client => {
  if (client.__starxPriceListLoaded) return;
  client.__starxPriceListLoaded = true;

  client.once(Events.ClientReady, async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID, { force: true });
      if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
        throw new Error(`Kanał cennika ${CHANNEL_ID} nie jest dostępny.`);
      }
      await upsertPanel(channel, panelPayload(), {
        panelKey: 'price-list',
        customId: MENU_ID,
        embedTitleIncludes: 'CENNIK',
        maxScan: 1500
      });
      console.log('✅ Cennik zaktualizowany');
    } catch (error) {
      console.error('❌ Cennik:', error?.stack || error);
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isStringSelectMenu?.() || interaction.customId !== MENU_ID) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      const embed = priceEmbed(interaction.values?.[0]);
      if (!embed) return interaction.editReply({ content: '❌ Nie rozpoznano wybranej kategorii.', embeds: [] });
      return interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      console.error('❌ Menu cennika:', error?.stack || error);
      const payload = { content: '❌ Nie udało się wyświetlić cennika. Spróbuj ponownie za chwilę.', embeds: [] };
      if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
};
