// Vérifie tous les liens internes du site généré (dist/) : pages, images, vidéos,
// polices, feuilles de styles et ancres (#…). Les liens vers d'autres sites ne sont pas testés.
//   node scripts/verifier-liens.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DIST = "dist";
const fichiersHtml = [];
const parcourir = (dossier) => {
  for (const nom of readdirSync(dossier)) {
    const complet = path.join(dossier, nom);
    if (statSync(complet).isDirectory()) parcourir(complet);
    else if (nom.endsWith(".html")) fichiersHtml.push(complet);
  }
};
parcourir(DIST);

const cacheIds = new Map();
function idsDe(fichier) {
  if (!cacheIds.has(fichier)) {
    const html = readFileSync(fichier, "utf8");
    cacheIds.set(fichier, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return cacheIds.get(fichier);
}

/** Fichier de dist/ correspondant à une URL interne, ou null s'il n'existe pas. */
// Site généré pour un sous-dossier (GitHub Pages) : on retire ce préfixe avant de chercher le fichier
const PREFIXE = (process.env.PREFIXE_CHEMIN || "/").replace(/\/$/, "");

function fichierPour(url, depuis) {
  let chemin = decodeURIComponent(url.split("#")[0].split("?")[0]);
  if (PREFIXE && chemin.startsWith(PREFIXE + "/")) chemin = chemin.slice(PREFIXE.length);
  if (chemin === "") return depuis; // lien vers une ancre de la même page
  chemin = chemin.startsWith("/") ? path.join(DIST, chemin) : path.join(path.dirname(depuis), chemin);
  const essais = [chemin, path.join(chemin, "index.html"), chemin + ".html"];
  return essais.find((essai) => existsSync(essai) && statSync(essai).isFile()) || null;
}

const erreurs = [];
let total = 0;

for (const fichier of fichiersHtml) {
  const html = readFileSync(fichier, "utf8");
  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src|poster|data-webm|data-mp4)="([^"]*)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const candidat of m[1].split(",")) urls.push(candidat.trim().split(/\s+/)[0]);
  }

  for (const brut of urls) {
    const url = brut.replace(/&amp;/g, "&");
    if (!url || /^(https?:|mailto:|tel:|data:)/i.test(url)) continue;
    total++;
    const cible = fichierPour(url, fichier);
    const page = "/" + path.relative(DIST, fichier).split(path.sep).join("/");
    if (!cible) {
      erreurs.push(`${page} → ${url} (fichier introuvable)`);
      continue;
    }
    const ancre = url.includes("#") ? decodeURIComponent(url.split("#")[1]) : "";
    if (ancre && cible.endsWith(".html") && !idsDe(cible).has(ancre)) {
      erreurs.push(`${page} → ${url} (ancre #${ancre} absente)`);
    }
  }
}

if (erreurs.length) {
  console.error(`✗ ${erreurs.length} lien(s) interne(s) cassé(s) :`);
  for (const erreur of erreurs) console.error("  " + erreur);
  process.exit(1);
}
console.log(`✓ Liens internes : ${total} liens vérifiés dans ${fichiersHtml.length} pages, aucun lien cassé.`);
