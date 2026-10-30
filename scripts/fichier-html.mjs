// Fabrique UN fichier HTML autonome contenant tout le site (12 pages, images, polices, vidéo, PDF),
// à envoyer par e-mail ou messagerie pour la relecture. Il s'ouvre sans connexion internet,
// d'un double-clic, dans n'importe quel navigateur récent.
//
//   npm run html            → LIVRABLES/3_VERSIONS_RELECTURE/site-broceliande-triathlon-vN.html
//
// Le numéro N est celui de la dernière version de relecture (partage/versions.json).
// Les pages sont réunies dans un seul document : la navigation passe par l'ancre de l'adresse
// (#le-club, #contact…). Les images sont intégrées une seule fois, au format WebP.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIST = "dist";
const SORTIE = "LIVRABLES/3_VERSIONS_RELECTURE";
const LARGEUR_MAX = 1280;

const PAGES = [
  ["accueil", "/", "index.html"],
  ["le-club", "/le-club/", "le-club/index.html"],
  ["nous-rejoindre", "/nous-rejoindre/", "nous-rejoindre/index.html"],
  ["entrainements", "/entrainements/", "entrainements/index.html"],
  ["vie-du-club", "/vie-du-club/", "vie-du-club/index.html"],
  ["evenements", "/evenements/", "evenements/index.html"],
  ["partenaires", "/partenaires/", "partenaires/index.html"],
  ["devenir-partenaire", "/partenaires/devenir-partenaire/", "partenaires/devenir-partenaire/index.html"],
  ["contact", "/contact/", "contact/index.html"],
  ["mentions-legales", "/mentions-legales/", "mentions-legales/index.html"],
  ["confidentialite", "/confidentialite/", "confidentialite/index.html"],
  ["page-404", "/404.html", "404.html"],
];
const pageDeUrl = Object.fromEntries(PAGES.map(([id, url]) => [url, id]));

const historique = existsSync("partage/versions.json") ? JSON.parse(readFileSync("partage/versions.json", "utf8")) : [];
const version = historique.at(-1) || { numero: 1, date: new Date().toISOString().slice(0, 10) };

const MIME = { ".webp": "image/webp", ".avif": "image/avif", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".mp4": "video/mp4", ".pdf": "application/pdf", ".json": "application/json", ".bin": "application/octet-stream" };
const enDataUri = (url) => {
  const fichier = path.join(DIST, decodeURIComponent(url.split("?")[0]));
  if (!existsSync(fichier)) throw new Error(`Fichier introuvable : ${url}`);
  return `data:${MIME[path.extname(fichier).toLowerCase()]};base64,${readFileSync(fichier).toString("base64")}`;
};

// Images : chacune stockée une seule fois, posée par le script au chargement
const images = new Map(); // chemin → clé
function cleImage(url) {
  if (!images.has(url)) images.set(url, String(images.size));
  return images.get(url);
}

/** <picture> d'eleventy-img → <img data-img> avec une seule version WebP de taille raisonnable. */
function simplifierImages(html) {
  return html.replace(/<picture>([\s\S]*?)<\/picture>/g, (bloc, contenu) => {
    const img = contenu.match(/<img\s[^>]*>/)[0];
    const srcsetWebp = contenu.match(/<source type="image\/webp" srcset="([^"]*)"/)?.[1];
    let choix = img.match(/\ssrc="([^"]*)"/)[1];
    if (srcsetWebp) {
      const candidats = srcsetWebp.split(",").map((c) => {
        const [url, largeur] = c.trim().split(/\s+/);
        return { url, largeur: parseInt(largeur || "0", 10) };
      }).sort((a, b) => a.largeur - b.largeur);
      const adaptes = candidats.filter((c) => !c.largeur || c.largeur <= LARGEUR_MAX);
      choix = (adaptes.at(-1) || candidats[0]).url;
    }
    const attributs = img
      .replace(/^<img/, "")
      .replace(/>$/, "")
      .replace(/\s(src|srcset|sizes)="[^"]*"/g, "");
    return `<img data-img="${cleImage(choix)}"${attributs}>`;
  });
}

// Documents PDF : un navigateur refuse d'ouvrir un PDF intégré directement dans un lien.
// Chacun est stocké une seule fois et ouvert dans un nouvel onglet par le script au chargement.
const documents = new Map(); // chemin → clé
function cleDocument(url) {
  if (!documents.has(url)) documents.set(url, String(documents.size));
  return documents.get(url);
}

/** Liens internes → ancres (#page ou #identifiant d'une section), PDF → documents intégrés. */
function convertirLiens(html) {
  return html.replace(/\shref="(\/[^"]*)"/g, (m, url) => {
    const [chemin, ancre] = url.split("#");
    if (chemin.startsWith("/assets/docs/")) {
      if (!existsSync(path.join(DIST, chemin))) throw new Error(`Document introuvable : ${chemin}`);
      return ` href="#documents" data-doc="${cleDocument(chemin)}" target="_blank" rel="noopener" aria-describedby="nouvel-onglet"`;
    }
    if (ancre) return ` href="#${ancre}"`;
    const page = pageDeUrl[chemin];
    if (!page) throw new Error(`Lien interne non reconnu : ${url}`);
    return ` href="#${page}"`;
  });
}

const lire = (fichier) => readFileSync(path.join(DIST, fichier), "utf8");
const accueil = lire("index.html");
const extraire = (html, motif, nom) => {
  const m = html.match(motif);
  if (!m) throw new Error(`Bloc introuvable : ${nom}`);
  return m[1] ?? m[0];
};

const enTete = extraire(accueil, /<header class="en-tete"[\s\S]*?<\/header>/, "en-tête");
const pied = extraire(accueil, /<footer class="pied"[\s\S]*?<\/footer>/, "pied de page");
// Bandeau d'accord Facebook et Instagram (affiché seulement sur les pages qui en ont)
const bandeauMeta = extraire(
  accueil,
  /<section class="bandeau-meta"[\s\S]*?<\/section>\s*<p class="sr-only" aria-live="polite" data-annonce-meta[^>]*><\/p>/,
  "bandeau d'accord Meta"
);
const titres = {};
const sections = PAGES.map(([id, , fichier]) => {
  const html = lire(fichier);
  titres[id] = extraire(html, /<title>([\s\S]*?)<\/title>/, `titre de ${fichier}`);
  const contenu = extraire(html, /<main id="contenu" tabindex="-1">([\s\S]*?)<\/main>/, `contenu de ${fichier}`);
  return `<div class="page-bt" data-page="${id}"${id === "accueil" ? "" : " hidden"}>\n${contenu}\n</div>`;
});

// Vérifie qu'aucun identifiant n'est utilisé deux fois en réunissant les pages
const ids = [...sections.join("\n").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const doublons = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (doublons.length) throw new Error(`Identifiants en double entre les pages : ${doublons.join(", ")}`);

let corps = [enTete, `<main id="contenu" tabindex="-1">`, ...sections, `</main>`, pied, bandeauMeta].join("\n");
corps = convertirLiens(simplifierImages(corps));
corps = corps
  .replace(/\sdata-webm="[^"]*"/, "")
  .replace(/\sdata-mp4="([^"]*)"/, (m, url) => ` data-mp4="${enDataUri(url)}"`);
const restes = corps.match(/\s(src|href|data-mp4)="\/[^"]*"/g);
if (restes) throw new Error(`Adresses internes non converties : ${restes.join(", ")}`);

const css = readFileSync(path.join(DIST, "assets/css/main.css"), "utf8")
  .replace(/url\("([^"]+)"\)/g, (m, url) => `url("${enDataUri(url.startsWith("/") ? url : path.posix.join("/assets/css/", url))}")`);
const js = readFileSync(path.join(DIST, "assets/js/main.js"), "utf8");
const dictionnaireDocs = Object.fromEntries(
  [...documents].map(([url, cle]) => [cle, readFileSync(path.join(DIST, url)).toString("base64")])
);
const dictionnaire = Object.fromEntries([...images].map(([url, cle]) => [cle, enDataUri(url)]));

const dateFr = new Date(version.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const document = `<!doctype html>
<html lang="fr" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titres.accueil}</title>
<link rel="icon" href="${enDataUri("/assets/img/favicon-32.png")}">
<script>document.documentElement.classList.replace("no-js", "js");</script>
<style>
${css}
.apercu-badge{position:fixed;z-index:50;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));background:#141213;color:#FF891C;border:1px solid #FF891C;border-radius:999px;padding:8px 14px;font:700 12px/1.2 Barlow,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
.bandeau-meta:not([hidden]) ~ .apercu-badge{display:none}
</style>
</head>
<body>
<a class="lien-evitement" href="#contenu">Aller au contenu</a>
${corps}
<span id="nouvel-onglet" hidden>(s'ouvre dans un nouvel onglet)</span>
<p class="apercu-badge" aria-hidden="true">Version ${version.numero} · aperçu du ${dateFr}</p>
<script>
// Images du site (intégrées au fichier)
var IMAGES_BT = ${JSON.stringify(dictionnaire)};
Array.prototype.forEach.call(document.querySelectorAll("img[data-img]"), function (img) { img.src = IMAGES_BT[img.getAttribute("data-img")]; });
</script>
<script>
// Documents PDF (intégrés au fichier), ouverts dans un nouvel onglet
(function () {
  var DOCS_BT = ${JSON.stringify(dictionnaireDocs)};
  var adresses = {};
  Array.prototype.forEach.call(document.querySelectorAll("a[data-doc]"), function (lien) {
    var cle = lien.getAttribute("data-doc");
    if (!adresses[cle]) {
      var binaire = window.atob(DOCS_BT[cle]);
      var octets = new Uint8Array(binaire.length);
      for (var i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
      adresses[cle] = URL.createObjectURL(new Blob([octets], { type: "application/pdf" }));
    }
    lien.href = adresses[cle];
  });
})();
</script>
<script>
${js}
</script>
<script>
// Navigation entre les pages réunies dans ce fichier (#accueil, #le-club, #contact…)
(function () {
  var TITRES = ${JSON.stringify(titres)};
  var PARENTS = { "devenir-partenaire": "partenaires" };
  var pages = Array.prototype.slice.call(document.querySelectorAll("[data-page]"));
  var liensMenu = Array.prototype.slice.call(document.querySelectorAll(".menu__nav a, .menu__adhesion"));
  // Bandeau d'accord : seulement sur les pages qui affichent des contenus Facebook ou Instagram
  var bandeau = document.querySelector("[data-bandeau-meta]");
  var bandeauActif = Boolean(bandeau && !bandeau.hidden);
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-accord-meta]")) bandeauActif = false;
    if (e.target.closest("[data-effacer-choix-meta]")) bandeauActif = true;
  });

  function afficher(id) {
    pages.forEach(function (p) {
      p.hidden = p.getAttribute("data-page") !== id;
      if (!p.hidden && bandeau) bandeau.hidden = !(bandeauActif && p.querySelector("[data-integration]"));
    });
    document.title = TITRES[id] || TITRES.accueil;
    liensMenu.forEach(function (lien) {
      var cible = lien.getAttribute("href").slice(1);
      lien.removeAttribute("aria-current");
      if (cible === id) lien.setAttribute("aria-current", "page");
      else if (PARENTS[id] === cible) lien.setAttribute("aria-current", "true");
    });
  }

  function naviguer() {
    var ancre = decodeURIComponent(location.hash.slice(1)) || "accueil";
    var burger = document.querySelector("[data-burger]");
    if (burger && burger.getAttribute("aria-expanded") === "true") burger.click();

    if (TITRES[ancre]) {
      afficher(ancre);
      window.scrollTo({ top: 0, behavior: "instant" });
      var principal = document.getElementById("contenu");
      if (principal && document.activeElement && document.activeElement !== document.body) principal.focus({ preventScroll: true });
      return;
    }
    var element = document.getElementById(ancre);
    if (!element) { afficher("page-404"); return; }
    var page = element.closest("[data-page]");
    if (page) afficher(page.getAttribute("data-page"));
    element.scrollIntoView();
  }

  window.addEventListener("hashchange", naviguer);
  naviguer();

  // Aperçu : ouvert depuis l'ordinateur (et non depuis le site), le script de Facebook ne peut pas
  // ajuster la taille des publications intégrées, qui restent invisibles. On leur donne une taille fixe.
  setInterval(function () {
    Array.prototype.forEach.call(document.querySelectorAll(".fb-post iframe"), function (iframe) {
      var publication = iframe.closest(".fb-post");
      if (iframe.offsetHeight || !publication.clientWidth) return;
      var largeur = Math.min(500, publication.clientWidth) + "px";
      [iframe.parentElement, iframe].forEach(function (element) {
        element.style.width = largeur;
        element.style.height = "700px";
        element.style.visibility = "visible";
      });
    });
  }, 1500);

  // Aperçu : le formulaire n'envoie rien
  document.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, note = f.querySelector(".apercu-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "apercu-note";
      note.setAttribute("role", "status");
      note.style.cssText = "margin:0;padding:12px 14px;border-radius:10px;background:#FFF1E3;font-size:15px";
      f.appendChild(note);
    }
    note.textContent = "Version d'aperçu : l'envoi du formulaire est désactivé. Sur le site en ligne, ce bouton enverra le message au club.";
  }, true);
})();
</script>
</body>
</html>
`;

mkdirSync(SORTIE, { recursive: true });
const nom = `${SORTIE}/site-broceliande-triathlon-v${version.numero}.html`;
writeFileSync(nom, document);
console.log(`${nom} : ${(statSync(nom).size / 1024 / 1024).toFixed(1)} Mo, ${images.size} images intégrées.`);
