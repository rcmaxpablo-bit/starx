# StarX Exchange style - zmiany

Zrobione pod wygląd ze screenów, ale z brandingiem **🌟 StarX Exchange**.

## Co zostało dodane/zmienione
- panel ticketów w stylu embeda jak na screenie,
- ticket wymiany z informacją o kwocie, metodzie i prowizji,
- przycisk przejęcia ticketa przez realizatora,
- embed „TICKET PRZEJĘTY”,
- przycisk danych płatności BLIK,
- embed „DANE PŁATNOŚCI BLIK”,
- embed do wystawienia legit checka po zamknięciu ticketa,
- cały branding w `tickets.js` ustawiony na **🌟 StarX Exchange**.

## Do ustawienia w `tickets.js`
- `PANEL_CHANNEL_ID`
- `REALIZATOR_ROLE_ID`
- `CLIENT_ROLE_ID`
- `LEGIT_CHECK_CHANNEL_ID`
- `OPINIE_CHANNEL_ID`
- dane w sekcji `PAYMENT`
- opcjonalnie linki bannerów przez zmienne środowiskowe `BANNER_TICKET_URL` i `BANNER_LEGIT_URL`.

## Poprawki 31.05
- Kolor embedów ticketów ustawiony na niebieski `#1b2dff`.
- Usunięty przycisk ustawień `⚙️` z ticketów.
- Usunięto tekst ze statystykami klienta z pierwszej wiadomości ticketu.
- Po przejęciu zostaje tylko embed `🌟 StarX Exchange × TICKET PRZEJĘTY` z informacją kto przejął ticket.
- Usunięto przyciski i embed z danymi płatności BLIK z flow przejmowania.
- Po wysłaniu legit checka dostęp zabierany jest klientowi, a realizator zostaje w tickecie.
- Zamknięcie nie usuwa już ticketa automatycznie po wysłaniu wzoru LC.


## Poprawka LC
- Usunięto podwójny ping na kanale legit-check.
- Klient nie traci dostępu do ticketa po samym wysłaniu embeda „WYSTAW LEGIT CHECKA”. Dostęp jest zabierany dopiero po wysłaniu przez klienta wiadomości `+rep` na kanale legit-check.

## Kategorie ticketów
- Nowo utworzone tickety trafiają do kategorii `1510410325038727311`.
- Po kliknięciu/przyjęciu ticketa kanał przenosi się do kategorii `1510410009853431868`.
- Nazwa kanału zmienia prefiks z `unlock-` na `lock-` po przejęciu.
- Przy oddaniu ticketa `/odprzyjmij` kanał wraca do kategorii nieprzejętych i prefiksu `unlock-`.
