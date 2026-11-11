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

/* Financing block in Marketplace listings (Brandon approved Nov 11 2026). Only brands whose Sheffield rate AND minimum
   amount financed are confirmed in writing. Source: Sheffield Hustler and Cub Cadet plans 11/1/2026 to 1/31/2027
   (Josh Anderson email 11/5). Each entry: [minimum financed, rate %, months], best (lowest payment) first.
   The $150 origination fee is financed with the loan, so it is in the payment and the APR (Reg Z finance charge). */
const FIN = {
  "HUSTLER":   [[6000, 0, 60], [2500, 0, 48], [1500, 0, 24]],
  "CUB CADET": [[6000, 0, 60], [2500, 0, 48], [1500, 0, 24]]
};
const FIN_END = "1/31/2027", ORIG_FEE = 150;
function finBlock(brand, price) {
  const plans = FIN[String(brand).toUpperCase()]; if (!plans) return "";
  const p = plans.find(x => price >= x[0]); if (!p) return "";
  const [min, rate, n] = p, loan = price + ORIG_FEE, r = rate / 1200;
  const pay = Math.round((r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n) * 100) / 100;
  const last = Math.round((loan * Math.pow(1 + r, n) - pay * ((Math.pow(1 + r, n) - 1) / (r || 1e-12)) * (r ? 1 : 0) + (r ? 0 : loan - pay * n)) * 100) / 100 + (r ? pay : pay);
  // final payment absorbs rounding (0% case: loan minus the other payments)
  const fin = r ? pay : Math.round((loan - pay * (n - 1)) * 100) / 100;
  const total = Math.round((pay * (n - 1) + fin) * 100) / 100;
  // APR: monthly rate i where the payments discount back to the price (amount financed excludes the prepaid fee)
  const pv = i => { let v = 0; for (let k = 1; k <= n; k++) v += (k < n ? pay : fin) / Math.pow(1 + i, k); return v; };
  let lo = 0, hi = 0.05; for (let t = 0; t < 200; t++) { const m = (lo + hi) / 2; if (pv(m) > price) lo = m; else hi = m; }
  const apr = (lo * 1200).toFixed(2);
  const money = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Financing example: $0 down and ${n} monthly payments of ${money(pay)}` + (fin !== pay ? ` (final payment ${money(fin)})` : "") +
    `. Interest rate ${rate}%, APR ${apr}%. Includes a $${ORIG_FEE} origination fee financed with the loan. Total of payments ${money(total)}. ` +
    `Offered by Sheffield Financial, a division of Truist Bank, Member FDIC, to qualified buyers on approved credit. Not all buyers qualify, and other rates and terms may apply. ` +
    `Minimum ${money(min).replace(".00", "")} financed. Offer ends ${FIN_END}. Payment does not include sales tax.`;
}
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
    `${String(u.name).toUpperCase().startsWith(u.brand.toUpperCase()) ? u.name : u.brand + " " + u.name}. Price ${"$" + price.toLocaleString("en-US",{minimumFractionDigits:2})} plus tax. Model ${u.model}. New, in stock now at ${dbaName} ${u.store}.`,
    (u.feats || []).slice(0, 4).map(f => String(f).replace(/[.\s]+$/, "") + ".").join(" "),
    u.fire ? "Fire Sale price. This unit only, while supplies last." : "Price applies to this unit only.",
    finBlock(u.brand, price) || "Price plus tax. Financing available, on approved credit. Lease to own options also available.",
    u.warranty ? String(u.warranty).replace(/^Warranty:\s*/, "Warranty: ") + "." : "",
    "Photo is a manufacturer photo. The unit in store may vary.",
    "Message us or stop by the store."
  ].filter(Boolean).join(" ").replace(/\.\./g, ".").replace(/\s{2,}/g, " ").slice(0, 4900);
  const row = {
    id: u.id, title: (String(u.name).toUpperCase().startsWith(u.brand.toUpperCase()) ? u.name : `${u.brand} ${u.name}`).slice(0, 150), description: desc, availability: "in stock", condition: "new",
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
