// Captures pleine page du site généré (dist/), pour comparer avec la maquette (_ATELIER/reference/captures/).
//   node scripts/captures.mjs                → toutes les pages, 1440 px et 390 px
//   node scripts/captures.mjs /le-club/ 1440 → une page, une largeur
// Les images sont enregistrées dans .cache/captures/.

import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { servirDossier, trouverNavigateur, listerPages } from "./outils.mjs";

const [, , pageDemandee, largeurDemandee] = process.argv;
const largeurs = largeurDemandee ? [Number(largeurDemandee)] : [1440, 390];
const pages = pageDemandee ? [pageDemandee] : listerPages();

await mkdir(".cache/captures", { recursive: true });
const serveur = await servirDossier("dist");
const navigateur = await puppeteer.launch({ executablePath: trouverNavigateur(), headless: true, args: ["--hide-scrollbars"] });

try {
  for (const largeur of largeurs) {
    const onglet = await navigateur.newPage();
    await onglet.setViewport({ width: largeur, height: largeur > 800 ? 900 : 844, deviceScaleFactor: 1 });
    await onglet.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    for (const page of pages) {
      await onglet.goto(serveur.url + page, { waitUntil: "networkidle0" });
      // Charge les images différées avant la capture
      await onglet.evaluate(async () => {
        document.querySelectorAll("img[loading=lazy]").forEach((img) => (img.loading = "eager"));
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
      });
      const nom = (page === "/" ? "accueil" : page.replace(/^\/|\/$/g, "").replace(/[\/.]/g, "_")) + `_${largeur}.png`;
      await onglet.screenshot({ path: `.cache/captures/${nom}`, fullPage: true });
      console.log(`✓ ${nom}`);
    }
    await onglet.close();
  }
} finally {
  await navigateur.close();
  await serveur.fermer();
}
