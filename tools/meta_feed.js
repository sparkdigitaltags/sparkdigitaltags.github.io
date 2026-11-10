/* Facebook Marketplace / Meta Commerce Manager catalog feeds (Brandon Nov 10 2026).
   Writes feeds/meta_<dba>.csv (one per DBA) and feeds/meta_<dba>_<store>.csv (one per store) from the live tag data.
   Commerce Manager fetches the CSV URL on a schedule, so a unit drops off Marketplace when it leaves the tag site.
   Compliance (same rules as the manual Post this unit button):
     only brands not in MARKET_OFF, only units whose price can show online (no maphide, no MAP release that expires),
     price = the tag price (one price for everyone), no payment, rate, term, down payment, Was or savings,
     no serial numbers, manufacturer photo note, Fire Sale "this unit only" line.
   Run after gen_links.js:  node tools/meta_feed.js */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), base = "https://sparkdigitaltags.github.io/";
const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
const D = JSON.parse(src.match(/const DATA = (\{.*?\});\n/s)[1]);
const OFF = JSON.parse(src.match(/const MARKET_OFF = (\{.*?\});/)[1]);
const pdir = path.join(root, "u", "p"), imgs = fs.existsSync(pdir) ? fs.readdirSync(pdir) : [];
const out = path.join(root, "feeds"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const slug = s => String(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const csv = v => { const s = String(v == null ? "" : v).replace(/\r?\n/g, " "); return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const COLS = ["id","title","description","availability","condition","price","link","image_link","brand","product_type","custom_label_0","custom_label_1","custom_label_2"];
const groups = {}, skipped = {};
const skip = r => skipped[r] = (skipped[r] || 0) + 1;
for (const u of D.units) {
  if (OFF[u.brand.toUpperCase()]) { skip("brand not cleared (" + u.brand + ")"); continue; }
  if (u.maphide || !u.now) { skip("price can't show online (MAP)"); continue; }
  if (u.mapfree) { skip("MAP release with an end date"); continue; }
  const img = u.photo && imgs.find(f => f.startsWith(u.photo + "."));
  if (!img) { skip("no photo"); continue; }
  const dbaName = u.dba || "LSM Outdoor Power";
  const price = Number(String(u.now).replace(/[^0-9.]/g, ""));
  if (!(price > 0)) { skip("no price"); continue; }
  const desc = [
    `${u.brand} ${u.name}. Model ${u.model}. New, in stock now at ${dbaName} ${u.store}.`,
    (u.feats || []).slice(0, 4).map(f => String(f).replace(/[.\s]+$/, "") + ".").join(" "),
    u.fire ? "Fire Sale price. This unit only, while supplies last." : "Price applies to this unit only.",
    "Price plus tax. Financing available, on approved credit. Lease to own options also available.",
    u.warranty ? String(u.warranty).replace(/^Warranty:\s*/, "Warranty: ") + "." : "",
    "Photo is a manufacturer photo. The unit in store may vary.",
    "Message us or stop by the store."
  ].filter(Boolean).join(" ").replace(/\.\./g, ".").slice(0, 4900);
  const row = {
    id: u.id, title: `${u.brand} ${u.name}`.slice(0, 150), description: desc, availability: "in stock", condition: "new",
    price: price.toFixed(2) + " USD", link: `${base}u/${u.id}.html?s=fbmp`, image_link: `${base}u/p/${img}`,
    brand: u.brand, product_type: "Outdoor Power Equipment", custom_label_0: u.store, custom_label_1: dbaName, custom_label_2: u.fire ? "Fire Sale" : ""
  };
  for (const k of [slug(dbaName), slug(dbaName) + "__" + slug(u.store)]) (groups[k] = groups[k] || []).push(row);
}
const index = [];
for (const [k, rows] of Object.entries(groups).sort()) {
  const f = "meta_" + k + ".csv";
  fs.writeFileSync(path.join(out, f), [COLS.join(",")].concat(rows.map(r => COLS.map(c => csv(r[c])).join(","))).join("\n") + "\n");
  index.push(`${base}feeds/${f}  (${rows.length} units)`);
}
fs.writeFileSync(path.join(out, "README.txt"), "Meta Commerce Manager scheduled feed URLs. Built " + new Date().toISOString() + "\n" + index.join("\n") + "\n");
console.log(index.join("\n")); console.log("skipped", JSON.stringify(skipped));
