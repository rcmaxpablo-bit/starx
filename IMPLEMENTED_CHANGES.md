# Wprowadzone zmiany

- Dodano przycisk **⚙️ Ustawienia Ticketa** i modal edycji kwoty, metody źródłowej oraz docelowej.
- Po zapisie aktualizowany jest temat kanału, nazwa ticketa, pamięć danych oraz istniejące embedy bota na tickecie.
- Prowizja jest przeliczana automatycznie po każdej zmianie.
- Wynik po prowizji jest zawsze obcinany w dół do pełnych 10 groszy (`Math.floor(value * 10) / 10`).
- Dodano automatyczne wysłanie Legit Checka po wiadomości `sent` niezależnie od wielkości liter.
- Dodano slash command `/dane` z osobnym formularzem dla BLIK/metod tradycyjnych i kryptowalut.
- Dodano obsługę LTC, BTC, ETH, SOL i USDT w danych portfela oraz ustawieniach wymiany.
- Przycisk **📋 Kopiuj dane** zwraca gotowe dane w prywatnej odpowiedzi, aby można było je łatwo skopiować.
- Nie usunięto istniejących komend ani modułów.
