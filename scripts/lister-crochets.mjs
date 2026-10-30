// Liste, page par page, les informations manquantes écrites [entre crochets] dans le site généré.
// Pratique pour vérifier qu'aucun texte provisoire ne reste avant une mise en ligne.
//   npm run build && npm run crochets

import { readFileSync } from "node:fs";
import { listerPages } from "./outils.mjs";

let total = 0;
for (const page of listerPages()) {
  const fichier = "dist" + (page.endsWith("/") ? page + "index.html" : page);
  const texte = readFileSync(fichier, "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/ /g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  const crochets = [...new Set([...texte.matchAll(/\[[^\]\n]{1,160}\]/g)].map((m) => m[0].replace(/\s+/g, " ")))];
  if (!crochets.length) continue;
  total += crochets.length;
  console.log(`\n${page}`);
  for (const c of crochets) console.log(`  - ${c}`);
}
console.log(`\n${total} texte(s) entre crochets.`);
