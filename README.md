# Spark Digital Tags

One page site behind the Spark QR code on LSM Outdoor Power price tags. Each QR opens index.html with a unit code after the #, and the page shows only that unit.

## Unit link pages
After any change to the units in index.html, run `node tools/gen_links.js` to rebuild u/ (one page per unit with its photo and name for Facebook link previews, no prices).
