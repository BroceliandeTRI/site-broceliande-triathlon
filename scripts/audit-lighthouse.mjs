// Audit Lighthouse (performance, accessibilité, bonnes pratiques, SEO) de chaque page du site
// généré, sur mobile et sur ordinateur, avec le Chrome installé. Lighthouse est téléchargé
// automatiquement par npx la première fois (connexion internet nécessaire).
//   npm run build && npm run audit
// Les rapports détaillés (HTML) sont enregistrés dans .cache/lighthouse/.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { servirDossier, trouverNavigateur, listerPages } from "./outils.mjs";

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const NOMS = { performance: "Perf.", accessibility: "Access.", "best-practices": "Bonnes pr.", seo: "SEO" };
const pages = listerPages().filter((page) => page !== "/404.html");

// Lance une commande sans bloquer le serveur local (qui tourne dans ce même programme)
function executer(commande, args, options) {
  return new Promise((resoudre) => {
    // Sous Windows, npx doit passer par l'interpréteur de commandes : on transmet une seule ligne
    const ligne = [commande, ...args.map((a) => `"${a}"`)].join(" ");
    const processus = spawn(ligne, { ...options, shell: true });
    let sortie = "";
    processus.stdout?.on("data", (d) => (sortie += d));
    processus.stderr?.on("data", (d) => (sortie += d));
    processus.on("close", (status) => resoudre({ status, sortie }));
  });
}
const serveur = await servirDossier("dist", 8099);
mkdirSync(".cache/lighthouse", { recursive: true });

const lignes = [];
let enDessous = 0;
try {
  for (const appareil of ["mobile", "ordinateur"]) {
    for (const page of pages) {
      const nom = `${appareil}${page === "/" ? "_accueil" : "_" + page.replace(/^\/|\/$/g, "").replace(/\//g, "_")}`;
      const args = [
        "--yes", "lighthouse@12", serveur.url + page,
        "--quiet",
        `--only-categories=${CATEGORIES.join(",")}`,
        "--output=json", "--output=html",
        `--output-path=.cache/lighthouse/${nom}`,
        "--chrome-flags=--headless=new",
      ];
      if (appareil === "ordinateur") args.push("--preset=desktop");
      const resultat = await executer("npx", args, {
        env: { ...process.env, CHROME_PATH: trouverNavigateur() },
      });
      if (resultat.status !== 0) {
        console.error(resultat.sortie);
        process.exit(1);
      }
      const rapport = JSON.parse(readFileSync(`.cache/lighthouse/${nom}.report.json`, "utf8"));
      const notes = CATEGORIES.map((c) => Math.round(rapport.categories[c].score * 100));
      enDessous += notes.filter((n) => n < 90).length;
      const ligne = `${appareil.padEnd(11)} ${page.padEnd(34)} ${CATEGORIES.map((c, i) => `${NOMS[c]} ${String(notes[i]).padStart(3)}`).join("  ")}`;
      lignes.push(ligne);
      console.log(ligne);
    }
  }
} finally {
  await serveur.fermer();
}

console.log(enDessous ? `\n✗ ${enDessous} note(s) sous 90.` : "\n✓ Toutes les notes sont à 90 ou plus.");
process.exit(enDessous ? 1 : 0);
