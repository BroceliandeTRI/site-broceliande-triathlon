// Fabrique la version PDF des guides (README, guide de gestion, guide du code), aux couleurs du club.
//
//   npm run guide   → guides/README.pdf, guides/GUIDE_GESTION.pdf, guides/GUIDE_CODE.pdf
//
// À relancer après chaque modification d'un guide. Utilise le navigateur Chrome ou Edge installé.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import markdownIt from "markdown-it";
import puppeteer from "puppeteer-core";
import { trouverNavigateur } from "./outils.mjs";

const GUIDES = [
  {
    source: "README.md",
    sortie: "guides/README.pdf",
    // L'introduction du fichier sert de chapeau sur la couverture
    introSurCouverture: true,
  },
  {
    source: "guides/GUIDE_GESTION.md",
    sortie: "guides/GUIDE_GESTION.pdf",
    introSurCouverture: true,
  },
  {
    source: "guides/GUIDE_CODE.md",
    sortie: "guides/GUIDE_CODE.pdf",
    chapeau: "À l'usage des bénévoles qui font vivre le site du Brocéliande Triathlon : comprendre une page web, gérer un site, et modifier le nôtre sans risque.",
    parties: [
      ["1. Les fondamentaux du HTML", "Lire et modifier n'importe quelle page web."],
      ["2. Les fondamentaux de la gestion d'un site", "Domaine, hébergement, sécurité, obligations légales, entretien."],
      ["3. Le code du site du BT", "Où trouver chaque élément, et des recettes pas à pas."],
    ],
  },
];

const url = (fichier) => pathToFileURL(path.resolve(fichier)).href;
const police = (fichier) => url(`node_modules/@fontsource/${fichier}`);
const echapper = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enLigne = (t) => echapper(t).replace(/`([^`]+)`/g, "<code>$1</code>");
const ancre = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dateFr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Titre de couverture sur deux lignes, la seconde en orange (« … et … » ou « … du … »)
function titreCouverture(titre) {
  const coupe = titre.match(/^(.+?)( et | du )(.+)$/);
  return coupe ? `${echapper(coupe[1])}<br><span>${echapper(coupe[2].trim() + " " + coupe[3])}</span>` : echapper(titre);
}

function preparer(guide) {
  // Les liens vers les autres guides (.md) deviennent le nom du fichier, lisible sur papier
  let texte = readFileSync(guide.source, "utf8").replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, "**$1** (fichier `$2`)");
  // Un sommaire écrit à la main (README) est remplacé par le sommaire cliquable du PDF
  texte = texte.replace(/\n## Sommaire\n[\s\S]*?(?=\n## )/, "\n");
  const lignes = texte.split("\n");
  const titre = lignes.shift().replace(/^#\s+/, "");
  texte = lignes.join("\n");
  const debut = texte.indexOf("\n## ");
  const intro = texte.slice(0, debut).replace(/^---$/gm, "").trim();
  texte = texte.slice(debut);

  const md = markdownIt({ html: false, linkify: false, typographer: false });
  const sommaire = [];
  md.core.ruler.push("ancres", (etat) => {
    etat.tokens.forEach((jeton, i) => {
      if (jeton.type !== "heading_open" || !["h2", "h3"].includes(jeton.tag)) return;
      const contenu = etat.tokens[i + 1].content;
      const id = "s-" + ancre(contenu);
      jeton.attrSet("id", id);
      sommaire.push({ niveau: jeton.tag, texte: contenu, id });
    });
  });
  const corps = md.render(texte);
  const chapeau = guide.introSurCouverture ? md.render(intro) : `<p>${echapper(guide.chapeau || "")}</p>`;
  const parties = guide.parties
    ? `<ol class="couverture__parties">${guide.parties.map(([t, d]) => `<li><b>${echapper(t)}</b>${echapper(d)}</li>`).join("")}</ol>`
    : "";
  const tableDesMatieres = sommaire.map((s) => `<li class="sommaire__${s.niveau}"><a href="#${s.id}">${enLigne(s.texte)}</a></li>`).join("\n");

  return { titre, html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre)}</title>
<style>
  @font-face { font-family: "Anton"; src: url("${police("anton/files/anton-latin-400-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 400; src: url("${police("barlow/files/barlow-latin-400-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 600; src: url("${police("barlow/files/barlow-latin-600-normal.woff2")}") format("woff2"); }
  @font-face { font-family: "Barlow"; font-weight: 700; src: url("${police("barlow/files/barlow-latin-700-normal.woff2")}") format("woff2"); }
  @page { size: A4; margin: 18mm 17mm 20mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Barlow", sans-serif; font-size: 10.5pt; line-height: 1.5; color: #141213; }

  /* Couverture */
  .couverture { height: 257mm; display: flex; flex-direction: column; justify-content: space-between; padding: 6mm 0 0; break-after: page; }
  .couverture img { height: 30mm; width: auto; align-self: flex-start; }
  .couverture h1 { margin: 0; font-family: "Anton", sans-serif; font-weight: 400; font-size: 44pt; line-height: .98; text-transform: uppercase; }
  .couverture h1 span { color: #ff891c; }
  .couverture__bandeau { height: 3mm; background: linear-gradient(90deg, #dd116a, #ff891c); margin: 8mm 0 6mm; }
  .couverture__chapeau { margin-top: 6mm; font-size: 12pt; color: #4f494b; max-width: 150mm; }
  .couverture__chapeau p { margin: 0 0 3mm; }
  .couverture__parties { margin: 10mm 0 0; padding: 0; list-style: none; display: grid; gap: 4mm; }
  .couverture__parties li { padding: 4mm 5mm; border-left: 2mm solid #dd116a; background: #f7f5f3; }
  .couverture__parties li:nth-child(2) { border-left-color: #ff891c; }
  .couverture__parties li:nth-child(3) { border-left-color: #141213; }
  .couverture__parties b { display: block; font-family: "Anton", sans-serif; font-weight: 400; font-size: 14pt; text-transform: uppercase; }
  .couverture__date { font-size: 9.5pt; color: #6b6466; border-top: .3mm solid #e4dedb; padding-top: 3mm; }

  /* Sommaire */
  .sommaire { break-after: page; }
  .sommaire h2 { margin: 0 0 5mm; }
  .sommaire ol { margin: 0; padding: 0; list-style: none; columns: 2; column-gap: 10mm; }
  .sommaire li { break-inside: avoid; }
  .sommaire a { color: inherit; text-decoration: none; }
  .sommaire__h2 { margin: 3mm 0 1mm; font-weight: 700; color: #b80d57; }
  .sommaire__h3 { padding-left: 4mm; font-size: 9.5pt; color: #4f494b; }

  /* Titres */
  h2, h3, h4 { font-family: "Anton", sans-serif; font-weight: 400; text-transform: uppercase; line-height: 1.1; break-after: avoid; }
  h2 { margin: 0 0 6mm; padding: 5mm 6mm; font-size: 22pt; background: #141213; color: #fff; border-bottom: 1.6mm solid #dd116a; }
  .contenu h2 { break-before: page; }
  h3 { margin: 8mm 0 3mm; padding-left: 3mm; font-size: 14.5pt; border-left: 1.4mm solid #dd116a; }
  h4 { margin: 5mm 0 2mm; font-size: 11.5pt; color: #b80d57; }
  h2 code, h3 code, h4 code { text-transform: none; font-size: .8em; }
  hr { display: none; }

  /* Texte */
  p { margin: 0 0 2.6mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  a { color: #b80d57; }
  strong { font-weight: 700; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f1ece9; padding: .2mm 1mm; border-radius: 1mm; }
  pre { margin: 0 0 4mm; padding: 3.5mm 4mm; background: #141213; color: #f7f5f3; border-radius: 1.5mm; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
  pre code { background: none; padding: 0; color: inherit; font-size: 8.8pt; }

  /* Tableaux */
  table { width: 100%; margin: 0 0 4mm; border-collapse: collapse; font-size: 9.5pt; }
  th { padding: 2mm 2.5mm; text-align: left; background: #141213; color: #fff; font-weight: 700; }
  td { padding: 2mm 2.5mm; vertical-align: top; border-bottom: .3mm solid #e4dedb; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f7f5f3; }
</style>
</head>
<body>
  <section class="couverture">
    <div>
      <img src="${url("src/assets/img/logo_bt_couleur.png")}" alt="Brocéliande Triathlon">
      <div class="couverture__bandeau"></div>
      <h1>${titreCouverture(titre)}</h1>
      <div class="couverture__chapeau">${chapeau}</div>
      ${parties}
    </div>
    <p class="couverture__date">Version du ${dateFr} · Source : ${guide.source}, PDF refait avec npm run guide</p>
  </section>

  <nav class="sommaire">
    <h2>Sommaire</h2>
    <ol>${tableDesMatieres}</ol>
  </nav>

  <main class="contenu">
${corps}
  </main>
</body>
</html>` };
}

mkdirSync(".cache", { recursive: true });
const navigateur = await puppeteer.launch({ executablePath: trouverNavigateur(), headless: true });
try {
  for (const guide of GUIDES) {
    const { titre, html } = preparer(guide);
    const fichierHtml = path.resolve(`.cache/${path.basename(guide.sortie, ".pdf")}.html`);
    writeFileSync(fichierHtml, html);
    const page = await navigateur.newPage();
    await page.goto(pathToFileURL(fichierHtml).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: guide.sortie,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;margin:0 17mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;color:#6b6466"><span>Brocéliande Triathlon · ${echapper(titre)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await page.close();
    console.log(`✓ ${guide.sortie}`);
  }
} finally {
  await navigateur.close();
}
