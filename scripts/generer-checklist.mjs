// Fabrique le document imprimable « Check-list du triathlète » (PDF, format A4)
// à partir de src/_data/checklist.json, avec le navigateur Chrome ou Edge installé.
//
//   npm run checklist   → src/assets/docs/check-list-triathlete.pdf (+ aperçu PNG dans .cache/)
//
// À relancer seulement si le contenu de checklist.json change. Le PDF est enregistré dans le projet.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { trouverNavigateur } from "./outils.mjs";

const donnees = JSON.parse(readFileSync("src/_data/checklist.json", "utf8"));
const url = (fichier) => pathToFileURL(path.resolve(fichier)).href;
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COULEURS = { rose: "#DD116A", orange: "#FF891C", noir: "#141213" };
const ICONES = {
  calendrier: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14l2.5 2.5L16 12"/></svg>',
  sac: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
};

const bloc = (s, classe = "") => `
  <section class="bloc${classe}" style="--accent: ${COULEURS[s.couleur] || COULEURS.noir}">
    <header class="bloc__tete">
      <span class="bloc__icone">${s.picto ? `<img src="${url("src/assets/img/" + s.picto)}" alt="">` : ICONES[s.icone] || ""}</span>
      <h2>${echapper(s.titre)}</h2>
    </header>
    <ul>
      ${s.elements.map((e) => `<li><span class="case"></span>${echapper(e)}</li>`).join("\n      ")}
    </ul>
  </section>`;

const [avant, jourJ, ...epreuves] = donnees.sections;
const police = (fichier) => url(`node_modules/@fontsource/${fichier}`);

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(donnees.titre)}</title>
<style>
  @font-face { font-family: "Anton"; src: url("${police("anton/files/anton-latin-400-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 400; src: url("${police("barlow/files/barlow-latin-400-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 600; src: url("${police("barlow/files/barlow-latin-600-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 700; src: url("${police("barlow/files/barlow-latin-700-normal.woff2")}") format("woff2"); }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    width: 210mm; height: 297mm; padding: 12mm 14mm 10mm;
    display: flex; flex-direction: column; gap: 6mm;
    font-family: "Barlow", sans-serif; color: #141213; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .entete { display: flex; align-items: center; justify-content: space-between; gap: 8mm; padding-bottom: 5mm; border-bottom: 1.6mm solid #DD116A; }
  .entete h1 { margin: 0; font-family: "Anton", sans-serif; font-weight: 400; font-size: 36pt; line-height: .95; text-transform: uppercase; }
  .entete h1 span { color: #FF891C; }
  .entete p { margin: 2mm 0 0; font-size: 11pt; font-weight: 600; color: #4F494B; }
  .entete img { height: 21mm; width: auto; }
  /* Ordre de lecture de la course : avant course (toute la largeur), puis jour J et natation à gauche, vélo et course à pied à droite */
  .grille { flex: 1; display: flex; flex-direction: column; gap: 5mm; }
  .bloc--large ul { display: block; columns: 2; column-gap: 10mm; }
  .bloc--large li { break-inside: avoid; margin-bottom: 3mm; }
  .epreuves { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .colonne { display: flex; flex-direction: column; gap: 5mm; }
  .colonne .bloc:last-child { flex: 1; }
  .bloc { border: .4mm solid #E4DEDB; border-top: 2.4mm solid var(--accent); border-radius: 0 0 3mm 3mm; padding: 4.5mm 6mm 5mm; break-inside: avoid; }
  .bloc__tete { display: flex; align-items: center; gap: 3mm; margin-bottom: 3mm; }
  .bloc__icone { width: 12mm; height: 9mm; display: inline-flex; align-items: center; justify-content: flex-start; color: var(--accent); }
  .bloc__icone img { max-width: 12mm; max-height: 9mm; }
  .bloc h2 { margin: 0; font-family: "Anton", sans-serif; font-weight: 400; font-size: 19pt; line-height: 1.05; text-transform: uppercase; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3mm; }
  li { display: flex; align-items: flex-start; gap: 3.5mm; font-size: 14pt; line-height: 1.25; }
  .case { flex: none; width: 5.4mm; height: 5.4mm; margin-top: .2mm; border: .5mm solid #141213; border-radius: 1mm; }
  .pied { display: flex; justify-content: space-between; gap: 6mm; padding-top: 3mm; border-top: .4mm solid #E4DEDB; font-size: 10pt; font-weight: 600; color: #4F494B; }
</style>
</head>
<body>
  <header class="entete">
    <div>
      <h1>${echapper(donnees.titre).replace(/triathlète/i, (m) => `<span>${m}</span>`)}</h1>
      <p>À cocher avant de partir.</p>
    </div>
    <img src="${url("src/assets/img/logo_bt_couleur.png")}" alt="Brocéliande Triathlon">
  </header>
  <main class="grille">
    ${bloc(avant, " bloc--large")}
    <div class="epreuves">
      <div class="colonne">
        ${bloc(jourJ)}
        ${bloc(epreuves[0])}
      </div>
      <div class="colonne">
        ${bloc(epreuves[1])}
        ${bloc(epreuves[2])}
      </div>
    </div>
  </main>
  <footer class="pied">
    <span>${donnees.note ? echapper(donnees.note) : ""}</span>
    <span>Brocéliande Triathlon</span>
  </footer>
</body>
</html>`;

mkdirSync(".cache", { recursive: true });
const source = path.resolve(".cache/check-list.html");
writeFileSync(source, html);

const navigateur = await puppeteer.launch({ executablePath: trouverNavigateur(), headless: true });
try {
  const page = await navigateur.newPage();
  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  // Le document doit tenir sur une seule page A4 (297 mm = 1123 px)
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  if (hauteur > 1123) {
    console.error(`✗ La check-list dépasse une page A4 (${hauteur} px au lieu de 1123). Raccourcis le contenu de src/_data/checklist.json.`);
    process.exitCode = 1;
  }
  mkdirSync("src/assets/docs", { recursive: true });
  await page.pdf({ path: `src/assets/docs/${donnees.fichier}`, format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  await page.screenshot({ path: ".cache/captures/check-list-apercu.png", fullPage: true });
  console.log(`✓ src/assets/docs/${donnees.fichier}`);
} finally {
  await navigateur.close();
}
