// regulamin.js
const { EmbedBuilder, Events } = require("discord.js");
const { upsertPanel } = require("./panelManager");

module.exports = (client) => {

  const CHANNEL_ID = "1499573020321124412";

  async function sendPanel() {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return console.log("❌ Nie znaleziono kanału regulamin.");

      const embed = new EmbedBuilder()
        .setColor('#1b2dff')
        .setTitle("<:regulamin:1501693215328440370> StarX Exchange • Regulamin")
        .setDescription(`
━━━━━━━━━━━━━━━━━━━━━━━  
<:pinezka:1501697389050986546> **POSTANOWIENIA OGÓLNE**

1. Korzystanie z serwera oznacza pełną akceptację regulaminu.  
2. Każdy użytkownik działa na własną odpowiedzialność.  
3. Administracja nie jest stroną żadnej transakcji.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:koszyk:1500243849535033577> **TRANSAKCJE I WYMIANY**

4. Wszystkie transakcje są dobrowolne między użytkownikami.  
5. Administracja nie ponosi odpowiedzialności za straty.  
6. Zaleca się korzystanie z usług middlemana (MM).  
7. Użytkownik ma obowiązek sprawdzić dane przed wysyłką środków.  
8. Transakcje kryptowalutowe są nieodwracalne.  
9. Zakaz wykonywania chargebacków / cofania płatności po otrzymaniu produktu.  
10. Zakazuje się marnowania czasu sprzedającemu oraz celowego przeciągania transakcji.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:zegarek:1502030015943151868> **GWARANCJA NA KONTA**

11. Gwarancja na konto obowiązuje przez 1 dzień od zakupu.  
12. Konto nie musi posiadać polskiego regionu ani polskich danych.  
13. Konto działa w systemie lifetime — dopóki użytkownik sam niczego nie anuluje lub nie zmieni, dostęp nie powinien wygasnąć sam z siebie.  
14. Zakaz zmiany danych konta bez zgody sprzedającego (email, hasło, 2FA itp.).  
15. Kupujący odpowiada za bezpieczeństwo konta po otrzymaniu danych.  
16. Aby otrzymać zwrot lub wymianę konta, wymagany jest film pokazujący próbę logowania po podaniu danych otrzymanych od sprzedającego.  
17. Brak nagrania może skutkować odrzuceniem reklamacji.  
18. Reklamacje należy zgłaszać w ciągu 24 godzin od otrzymania danych.  
19. Zakaz udostępniania zakupionych kont osobom trzecim.  
20. W przypadku odzyskania konta przez właściciela administracja nie odpowiada za straty.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:bilet:1501697124734206032> **OFERTY I OGŁOSZENIA**

21. Każda oferta musi być czytelna i zawierać szczegóły.  
22. Zakaz publikowania fałszywych ofert.  
23. Zakaz sprzedaży treści nielegalnych.  
24. Zakaz spamowania i powielania ogłoszeń.  
25. Sprzedający ma obowiązek podać prawdziwe informacje o produkcie.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:klodka:1501697222901895258> **BEZPIECZEŃSTWO**

26. Zakaz wszelkich prób oszustwa (scam).  
27. Zakaz podszywania się pod użytkowników lub administrację.  
28. Zakaz obchodzenia systemów zabezpieczeń oraz MM.  
29. Podejrzane działania należy zgłaszać administracji.  
30. Próba oszustwa skutkuje permanentnym banem bez możliwości odwołania.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:piorun:1501697151737139350> **ZACHOWANIE NA SERWERZE**

31. Zakaz obrażania i toksycznego zachowania.  
32. Zakaz reklam bez zgody administracji.  
33. Zakaz publikowania treści NSFW.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:admin:1501989271077388500> **SPORY I DECYZJE**

34. W przypadku sporów wymagane są dowody (screeny, logi, nagrania).  
35. Administracja może odmówić pomocy w przypadku złamania regulaminu.  
36. Decyzja administracji jest ostateczna.  
37. Naruszenie zasad skutkuje karą (mute / kick / ban).  

━━━━━━━━━━━━━━━━━━━━━━━  
<:wsparcie:1500243961124618381> **POSTANOWIENIA KOŃCOWE**

38. Regulamin może ulec zmianie w dowolnym momencie.  
39. Nieznajomość regulaminu nie zwalnia z jego przestrzegania.  
40. Kupując produkt, użytkownik akceptuje ryzyko związane z cyfrowymi usługami i kontami.  

━━━━━━━━━━━━━━━━━━━━━━━  
<:uwaga:1501693444030992395> **Zachowaj ostrożność — unikaj podejrzanych transakcji.**
        `)
        .setFooter({
          text: "© 2026 StarX Exchange"
        })
        .setTimestamp();

      await upsertPanel(channel, { embeds: [embed] }, {
        embedTitle: "<:regulamin:1501693215328440370> StarX Exchange • Regulamin"
      });

      console.log("✅ Regulamin zaktualizowany");

    } catch (err) {
      console.log("❌ Błąd regulamin.js:", err);
    }
  }

  if (client.isReady()) {
    sendPanel();
  } else {
    client.once(Events.ClientReady, sendPanel);
  }
};
