/* Builds one small page per unit at u/<id>.html so Facebook and other apps show the unit photo and name when a tag link is shared.
   The page sends people straight on to the digital tag. No prices go in these pages (MAP and Truth in Lending).
   Run after any change to the units in index.html:  node tools/gen_links.js */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), base = "https://sparkdigitaltags.github.io/";
const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
const D = JSON.parse(src.match(/const DATA = (\{.*?\});\n/s)[1]);
const out = path.join(root, "u"), pdir = path.join(out, "p");
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(pdir, { recursive: true });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const writeImg = (key, uri) => { const m = /^data:image\/(\w+);base64,(.*)$/s.exec(uri || ""); if (!m) return ""; const ext = m[1] === "jpeg" ? "jpg" : m[1]; const f = key + "." + ext; if (!fs.existsSync(path.join(pdir, f))) fs.writeFileSync(path.join(pdir, f), Buffer.from(m[2], "base64")); return f; };
const logo = writeImg("logo", D.logo);
let n = 0;
for (const u of D.units) {
  const img = (u.photo && writeImg(u.photo, D.photos[u.photo])) || logo;
  const dba = (u.dba || "LSM Outdoor Power") + " " + u.store;
  const title = `${u.brand} ${u.name}`;
  const desc = `Model ${u.model}. In stock at ${dba}. Financing available, on approved credit.`;
  const url = `${base}u/${u.id}.html`;
  fs.writeFileSync(path.join(out, u.id + ".html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | ${esc(dba)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(dba)}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${base}u/p/${img}">
<meta name="twitter:card" content="summary_large_image"><meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;text-align:center;margin:20vh 16px;color:#333}a{color:#0b57d0}</style></head>
<body><p>Opening this unit's digital tag... <a id="go" href="../#${esc(u.id)}">Tap here if it doesn't open.</a></p>
<script>location.replace("../" + location.search + "#${u.id}");</script></body></html>`);
  n++;
}
console.log(n + " unit pages, " + fs.readdirSync(pdir).length + " images");

// Facebook Marketplace catalog feeds follow the unit pages (Nov 10 2026)
require("./meta_feed.js");
