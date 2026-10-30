// Contrôle d'accessibilité automatique (axe-core, règles WCAG 2.2 A et AA) de chaque page,
// sur ordinateur (1440 px) et sur mobile (390 px), puis recherche de défilement horizontal
// de 360 à 1920 px de large. Utilise le navigateur Chrome (ou Edge) installé.
//   node scripts/verifier-accessibilite.mjs

import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { servirDossier, trouverNavigateur, listerPages } from "./outils.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const REGLES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const LARGEURS_AXE = [1440, 390];
const LARGEURS_DEBORDEMENT = [360, 390, 480, 768, 1024, 1100, 1280, 1440, 1920];

const pages = listerPages();
const serveur = await servirDossier("dist");
const navigateur = await puppeteer.launch({ executablePath: trouverNavigateur(), headless: true });
const problemes = [];

try {
  const onglet = await navigateur.newPage();

  for (const largeur of LARGEURS_AXE) {
    await onglet.setViewport({ width: largeur, height: 900 });
    for (const page of pages) {
      await onglet.goto(serveur.url + page, { waitUntil: "networkidle0" });
      await onglet.addScriptTag({ path: AXE });
      const resultat = await onglet.evaluate(async (regles) => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: regles } });
        return r.violations.map((v) => ({
          regle: v.id,
          impact: v.impact,
          aide: v.help,
          cibles: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
        }));
      }, REGLES);
      for (const v of resultat) {
        problemes.push(`[axe ${largeur}px] ${page} : ${v.regle} (${v.impact}) ${v.aide}\n      ${v.cibles.join("\n      ")}`);
      }
    }
  }

  // États interactifs : saison mai – septembre, puis menu burger ouvert au clavier
  async function analyser(description) {
    await onglet.addScriptTag({ path: AXE });
    const violations = await onglet.evaluate(async (regles) => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: regles } });
      return r.violations.map((v) => `${v.id} (${v.impact}) ${v.help} : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
    }, REGLES);
    for (const v of violations) problemes.push(`[axe] ${description} : ${v}`);
  }

  await onglet.setViewport({ width: 1440, height: 900 });
  await onglet.goto(serveur.url + "/entrainements/", { waitUntil: "networkidle0" });
  await onglet.focus('[data-saison="ete"]');
  await onglet.keyboard.press("Enter");
  const ete = await onglet.evaluate(() => ({
    presse: document.querySelector('[data-saison="ete"]').getAttribute("aria-pressed"),
    visible: !document.querySelector('.semaine-visuelle[data-saison-panneau="ete"]').hidden,
    hiverCache: document.querySelector('.semaine-visuelle[data-saison-panneau="hiver"]').hidden,
  }));
  if (ete.presse !== "true" || !ete.visible || !ete.hiverCache) problemes.push("[clavier] La bascule vers mai – septembre ne fonctionne pas au clavier");
  await analyser("/entrainements/ (mai – septembre)");

  await onglet.setViewport({ width: 390, height: 844 });
  await onglet.goto(serveur.url + "/", { waitUntil: "networkidle0" });
  await onglet.focus("[data-burger]");
  await onglet.keyboard.press("Enter");
  const ouvert = await onglet.evaluate(() => document.querySelector("[data-burger]").getAttribute("aria-expanded") === "true");
  if (!ouvert) problemes.push("[clavier] Le menu burger ne s'ouvre pas au clavier");
  await analyser("/ (menu burger ouvert, 390 px)");
  for (let i = 0; i < 25; i++) await onglet.keyboard.press("Tab");
  const focusDansEnTete = await onglet.evaluate(() => Boolean(document.activeElement.closest("[data-en-tete]")));
  if (!focusDansEnTete) problemes.push("[clavier] Le focus sort du menu burger ouvert (piège du focus inactif)");
  await onglet.keyboard.press("Escape");
  const ferme = await onglet.evaluate(() => ({
    etat: document.querySelector("[data-burger]").getAttribute("aria-expanded"),
    focus: document.activeElement.matches("[data-burger]"),
  }));
  if (ferme.etat !== "false" || !ferme.focus) problemes.push("[clavier] Échap ne referme pas le menu burger ou ne rend pas le focus au bouton");

  // Fenêtre des horaires de la piscine ouverte
  await onglet.setViewport({ width: 1440, height: 900 });
  await onglet.goto(serveur.url + "/entrainements/", { waitUntil: "networkidle0" });
  await onglet.click("[data-ouvrir-dialogue]");
  const dialogueOuvert = await onglet.evaluate(() => document.getElementById("horaires-piscine").open);
  if (!dialogueOuvert) problemes.push("[fenêtre] Les horaires de la piscine ne s'ouvrent pas");
  else await analyser("/entrainements/ (horaires de la piscine ouverts)");

  for (const largeur of LARGEURS_DEBORDEMENT) {
    await onglet.setViewport({ width: largeur, height: 900 });
    for (const page of pages) {
      await onglet.goto(serveur.url + page, { waitUntil: "networkidle0" });
      const debordement = await onglet.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (debordement > 0) problemes.push(`[défilement] ${page} à ${largeur}px : la page dépasse de ${debordement}px`);
    }
  }
} finally {
  await navigateur.close();
  await serveur.fermer();
}

if (problemes.length) {
  console.error(`✗ ${problemes.length} problème(s) d'accessibilité ou de mise en page :`);
  for (const p of problemes) console.error("  " + p);
  process.exit(1);
}
console.log(`✓ Accessibilité : ${pages.length} pages, 0 erreur axe (1440 et 390 px), aucun défilement horizontal de 360 à 1920 px.`);
