import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

import site from "./src/_data/site.json" with { type: "json" };

// Adresse publique du site (balises canoniques, Open Graph, sitemap).
// On peut la remplacer au moment de générer le site : URL_SITE=https://... npm run build
const URL_SITE = (process.env.URL_SITE || site.url).replace(/\/$/, "");

// Sous-dossier de publication : "/" à la racine d'un nom de domaine,
// "/nom-du-depot/" sur une adresse GitHub Pages du type https://compte.github.io/nom-du-depot/
const PREFIXE_CHEMIN = process.env.PREFIXE_CHEMIN || "/";

const POLICES = [
  ["@fontsource/anton/files/anton-latin-400-normal.woff2", "anton-400.woff2"],
  ["@fontsource/barlow/files/barlow-latin-400-normal.woff2", "barlow-400.woff2"],
  ["@fontsource/barlow/files/barlow-latin-500-normal.woff2", "barlow-500.woff2"],
  ["@fontsource/barlow/files/barlow-latin-600-normal.woff2", "barlow-600.woff2"],
  ["@fontsource/barlow/files/barlow-latin-700-normal.woff2", "barlow-700.woff2"],
  ["@fontsource/barlow/files/barlow-latin-800-normal.woff2", "barlow-800.woff2"],
];

/** Nombre de jours de calendrier (heure de Paris) entre aujourd'hui et la date cible. */
export function joursAvant(cibleIso, maintenant = new Date()) {
  const jourParis = (date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(date)
      .split("-")
      .map(Number);
  const [a1, m1, j1] = jourParis(maintenant);
  const [a2, m2, j2] = jourParis(new Date(cibleIso));
  return Math.max(0, Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86400000));
}

/**
 * Frise de l'agenda. Une date « AAAA-MM » est passée après la fin du mois, « AAAA-MM-JJ » après le jour.
 * Les rendez-vous sont rangés dans l'ordre : tout ce qui précède le dernier rendez-vous daté passé
 * est considéré comme passé (y compris un rendez-vous dont la date n'est pas encore connue).
 * Renvoie le nombre de rendez-vous passés et la position du repère « aujourd'hui » sur la piste.
 */
export function progressionAgenda(agenda = [], maintenant = new Date()) {
  const n = agenda.length;
  if (!n) return { passes: 0, pourcentage: 0 };
  const fin = (date) => {
    const [a, m, j] = date.split("-").map(Number);
    return j ? new Date(a, m - 1, j, 23, 59) : new Date(a, m, 0, 23, 59);
  };
  let passes = 0;
  agenda.forEach((rdv, i) => {
    if (rdv.date && fin(rdv.date) < maintenant) passes = i + 1;
  });
  const position = (i) => ((i + 0.5) / n) * 100;
  const pourcentage = passes === 0 ? position(0) / 2 : passes >= n ? 100 : (position(passes - 1) + position(passes)) / 2;
  return { passes, pourcentage: Math.round(pourcentage * 10) / 10 };
}

/** Espaces insécables de la typographie française, appliquées au texte seulement (jamais aux balises). */
function typographie(html) {
  const morceaux = html.split(/(<[^>]+>)/);
  let ignorer = 0;
  return morceaux
    .map((morceau) => {
      if (morceau.startsWith("<")) {
        if (/^<(script|style|textarea|pre|title|option)\b/i.test(morceau)) ignorer++;
        else if (/^<\/(script|style|textarea|pre|title|option)>/i.test(morceau)) ignorer = Math.max(0, ignorer - 1);
        return morceau;
      }
      if (ignorer) return morceau;
      return morceau
        .replace(/ ([!?;:»])/g, " $1")
        .replace(/« /g, "« ")
        .replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ")
        .replace(/(\d) (?=(?:m|km|€|ans)(?![\p{L}]))/gu, "$1 ")
        .replace(/(?<![\w-])(\d+-\d+)(?![\w-])/g, '<span class="insecable">$1</span>');
    })
    .join("");
}

/** Les liens vers d'autres sites s'ouvrent dans un nouvel onglet (annoncé aux lecteurs d'écran). */
function liensExternes(html) {
  const hote = new URL(URL_SITE).host;
  return html.replace(/<a\s[^>]*>/g, (balise) => {
    const href = balise.match(/href="(https?:\/\/[^"]+)"/)?.[1];
    if (!href || /\starget=/.test(balise) || new URL(href).host === hote) return balise;
    return balise.replace(/^<a\s/, '<a target="_blank" rel="noopener" aria-describedby="nouvel-onglet" ');
  });
}

/** Image de partage (Open Graph) et icônes du site, générées à partir des images du kit. */
async function genererImagesFixes(dossierSortie) {
  const img = path.join(dossierSortie, "assets", "img");
  await mkdir(img, { recursive: true });

  await sharp("src/assets/img/hero_lac_aube.jpg")
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(img, "partage-lac.jpg"));

  // Emblème blanc et rose sur fond noir, au centre d'un carré
  const icone = async (taille) => {
    const embleme = await sharp("src/assets/img/embleme_o_hermine.png")
      .resize({ height: Math.round(taille * 0.84), fit: "inside" })
      .toBuffer();
    return sharp({ create: { width: taille, height: taille, channels: 4, background: "#141213" } })
      .composite([{ input: embleme, gravity: "center" }])
      .png()
      .toBuffer();
  };

  const png32 = await icone(32);
  await writeFile(path.join(img, "favicon-32.png"), png32);
  await writeFile(path.join(dossierSortie, "apple-touch-icon.png"), await icone(180));
  await writeFile(path.join(img, "icone-512.png"), await icone(512));

  // favicon.ico : conteneur ICO qui embarque directement le PNG 32×32
  const entete = Buffer.alloc(22);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type : icône
  entete.writeUInt16LE(1, 4); // une image
  entete.writeUInt8(32, 6); // largeur
  entete.writeUInt8(32, 7); // hauteur
  entete.writeUInt8(0, 8); // palette
  entete.writeUInt8(0, 9); // réservé
  entete.writeUInt16LE(1, 10); // plans
  entete.writeUInt16LE(32, 12); // bits par pixel
  entete.writeUInt32LE(png32.length, 14); // taille des données
  entete.writeUInt32LE(22, 18); // position des données
  await writeFile(path.join(dossierSortie, "favicon.ico"), Buffer.concat([entete, png32]));
}

export default function (eleventyConfig) {
  // Fichiers copiés tels quels
  eleventyConfig.addPassthroughCopy({
    "src/assets/css": "assets/css",
    "src/assets/js": "assets/js",
    "src/assets/video/*.{mp4,webm}": "assets/video",
    "src/assets/docs/*.pdf": "assets/docs",
  });
  for (const [source, nom] of POLICES) {
    eleventyConfig.addPassthroughCopy({ [`node_modules/${source}`]: `assets/fonts/${nom}` });
  }

  // Images : AVIF et WebP (plus le format d'origine en secours), largeur et hauteur ajoutées,
  // chargement différé par défaut (les images du premier écran passent loading="eager").
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "auto"],
    widths: ["auto"],
    urlPath: "/assets/img/",
    outputDir: "./dist/assets/img/",
    sharpAvifOptions: { quality: 55, effort: 4 },
    sharpWebpOptions: { quality: 78 },
    sharpJpegOptions: { quality: 80, mozjpeg: true },
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
    },
  });

  eleventyConfig.on("eleventy.before", async ({ directories }) => {
    await genererImagesFixes(directories.output);
  });

  // Ajoute le sous-dossier de publication aux liens internes (href, src, srcset…) si besoin
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addGlobalData("layout", "layouts/base.njk");
  eleventyConfig.addGlobalData("urlSite", URL_SITE);
  eleventyConfig.addGlobalData("generation", () => ({ annee: new Date().getFullYear(), date: new Date() }));

  // Filtres utilisables dans les gabarits
  eleventyConfig.addFilter("joursAvant", (cible) => joursAvant(cible));
  eleventyConfig.addFilter("heureDecimale", (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h + m / 60;
  });
  eleventyConfig.addFilter("horaire", (hhmm) => {
    const [h, m] = String(hhmm).split(":");
    return `${Number(h)}h${m}`;
  });
  eleventyConfig.addFilter("arrondi", (n, decimales = 2) => Number(Number(n).toFixed(decimales)));
  eleventyConfig.addFilter("premiers", (liste, n) => (liste || []).slice(0, n));
  // Frise de l'agenda : nombre de rendez-vous passés et position du repère « aujourd'hui » (en %)
  eleventyConfig.addFilter("progressionAgenda", (agenda, maintenant = new Date()) => progressionAgenda(agenda, maintenant));
  eleventyConfig.addFilter("filtrer", (liste, cle, valeur) => (liste || []).filter((element) => element[cle] === valeur));
  // Publications dont la date ou la légende est encore entre crochets : masquées tant qu'elles ne sont pas complétées
  eleventyConfig.addFilter("completes", (liste) => (liste || []).filter((p) => !/\[/.test(`${p.date} ${p.legende}`)));
  eleventyConfig.addFilter("exclure", (liste, cle, valeur) => (liste || []).filter((element) => element[cle] !== valeur));
  eleventyConfig.addFilter("dateIso", (date) => new Date(date).toISOString().slice(0, 10));
  eleventyConfig.addFilter("urlAbsolue", (url) => URL_SITE + url);
  eleventyConfig.addFilter("avecPrefixe", (url) => PREFIXE_CHEMIN.replace(/\/$/, "") + url);

  eleventyConfig.addTransform("typographie-et-liens", function (contenu) {
    if (!(this.page.outputPath || "").endsWith(".html")) return contenu;
    return liensExternes(typographie(contenu));
  });

  eleventyConfig.setServerOptions({ port: 8080, showAllHosts: false });
}

export const config = {
  pathPrefix: PREFIXE_CHEMIN,
  dir: {
    input: "src",
    output: "dist",
    includes: "_includes",
    data: "_data",
  },
  templateFormats: ["njk", "md"],
  htmlTemplateEngine: "njk",
  markdownTemplateEngine: "njk",
};
