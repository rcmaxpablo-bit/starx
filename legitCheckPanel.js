const {
  Events,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = (client) => {
  const CHANNEL_ID = '1500893110048133253';
  const PANEL_MARKER = 'STARX_LEGIT_CHECK_PANEL_V3';
  let operation = Promise.resolve();

  const EMOJI = {
    nitro: '<a:nitro:1501684762601848963>',
    list: '<:LIST:1501693215328440370>',
    arrow: '<a:Arrow_White:1508094625984811038>',
    pin: '<:PIN:1501697389050986546>'
  };

  function createEmbed() {
    return new EmbedBuilder()
      .setColor('#1b2dff')
      .setTitle('🌟 StarX Exchange × LEGIT CHECK')
      .setDescription([
        `${EMOJI.nitro} Dziękujemy za wybranie **StarX Exchange!**`,
        '',
        `${EMOJI.list} Twój legit check jest dla nas bardzo ważny i pomaga budować zaufanie.`,
        '',
        `${EMOJI.arrow} **WZÓR LEGIT CHECKA**`,
        '```',
        '+rep @seller Purchased [co] [kwota]PLN [metoda]',
        '```',
        '',
        `${EMOJI.arrow} **PRZYKŁAD**`,
        '```',
        '+rep @jarek.svx Purchased Konto Stake 40PLN [BLIK]',
        '```',
        '',
        `${EMOJI.pin} Po wystawieniu legit checka ticket zostanie automatycznie zamknięty.`
      ].join('\n'))
      .setFooter({ text: `© 2026 StarX Exchange • ${PANEL_MARKER}` });
  }

  function isLegitPanel(message) {
    if (message.author?.id !== client.user?.id) return false;
    return message.embeds?.some((embed) => {
      const title = String(embed.title || '');
      const description = String(embed.description || '');
      const footer = String(embed.footer?.text || '');
      return title.includes('LEGIT CHECK') && (
        footer.includes('STARX_LEGIT_CHECK_PANEL') ||
        description.includes('WZÓR LEGIT CHECKA') ||
        description.includes('WZÓR LEGIT CHECK')
      );
    });
  }

  async function getChannel() {
    const channel = await client.channels.fetch(CHANNEL_ID, { force: true });
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      throw new Error(`Kanał ${CHANNEL_ID} nie jest kanałem tekstowym.`);
    }

    const me = channel.guild?.members?.me;
    const perms = me ? channel.permissionsFor(me) : null;
    const required = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages
    ];
    const missing = perms ? required.filter((perm) => !perms.has(perm)) : [];
    if (missing.length) {
      console.warn('⚠️ LEGIT PANEL: bot nie ma wszystkich zalecanych uprawnień (View/Send/Embed/History/ManageMessages).');
    }
    return channel;
  }

  async function replacePanel(reason) {
    const channel = await getChannel();

    // Najpierw wysyłamy nową kopię, żeby panel zawsze pozostał na kanale.
    const sent = await channel.send({ embeds: [createEmbed()] });

    // Następnie usuwamy wszystkie starsze kopie. Pobieramy kilka stron,
    // aby znaleźć panel nawet wtedy, gdy po nim pojawiło się dużo wiadomości.
    let before;
    let scanned = 0;
    let removed = 0;
    while (scanned < 500) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!batch.size) break;
      scanned += batch.size;

      for (const message of batch.values()) {
        if (message.id === sent.id) continue;
        if (!isLegitPanel(message)) continue;
        await message.delete().then(() => { removed += 1; }).catch((error) => {
          console.error(`❌ LEGIT PANEL: nie udało się usunąć starego panelu ${message.id}:`, error?.message || error);
        });
      }

      before = batch.last()?.id;
      if (batch.size < 100) break;
    }

    console.log(`✅ LEGIT PANEL: wysłano nowy (${reason}), usunięto starych: ${removed}. ID: ${sent.id}`);
  }

  function enqueueReplace(reason) {
    operation = operation
      .then(() => replacePanel(reason))
      .catch((error) => console.error('❌ LEGIT PANEL ERROR:', error?.stack || error));
    return operation;
  }

  client.once(Events.ClientReady, () => {
    enqueueReplace('start bota');
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== CHANNEL_ID) return;
    const content = String(message.content || '').trim();
    if (!/^\+rep(?:\s|$)/i.test(content)) return;

    // Każda wiadomość +rep (także od bota lub webhooka) odświeża panel.
    enqueueReplace(`po +rep ${message.id}`);
  });
};
