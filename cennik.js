/**
 * Ten plik był przypadkową kopią modułu autolc.js. Powodowało to podwójną
 * obsługę komendy /autolc, dwukrotne wysyłanie webhooka oraz błędy typu
 * "Interaction has already been acknowledged".
 *
 * Moduł pozostaje bez listenerów, dopóki nie zostanie tu przywrócona właściwa
 * konfiguracja panelu cennika (kanał, produkty i ceny).
 */
module.exports = () => {
  console.log("ℹ️ Cennik: wyłączono uszkodzony duplikat modułu /autolc.");
};
