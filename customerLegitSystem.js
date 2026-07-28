# Naprawa cennika

- menu jest potwierdzane natychmiast przez `deferReply({ flags: 64 })`,
- obsługiwany jest aktualny i starszy `customId`,
- stary panel jest rozpoznawany także po kanale oraz tytule `CENNIK`,
- listener cennika jest rejestrowany przez `prependListener`,
- panel jest edytowany przez wspólny `upsertPanel`,
- emoji opcji menu korzystają wyłącznie z prawidłowych identyfikatorów Discorda.
