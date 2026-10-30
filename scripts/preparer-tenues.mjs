// Recadre les visuels des tenues (src/_data/tenues.json) pour qu'ils tiennent entiers dans le losange.
//
//   npm run tenues
//
// Pour chaque image (fond blanc), le script repère l'article, cherche le plus petit losange qui le
// contient en entier, puis enregistre une image carrée (900 × 900, fond blanc) centrée sur ce losange.
// À relancer après l'ajout d'un nouveau visuel. Relancer sur une image déjà traitée ne la change pas.

import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DOSSIER = "src/assets/img";
const SEUIL_BLANC = 235; // un pixel plus clair que ce seuil sur les trois couleurs compte comme fond
const MARGE = 0.06; // espace laissé entre l'article et le bord du losange
const TAILLE = 900;

const tenues = JSON.parse(readFileSync("src/_data/tenues.json", "utf8"));
const images = [...new Set(tenues.disciplines.flatMap((d) => d.groupes.flatMap((g) => g.articles.map((a) => a.image))))];

async function recadrer(nom) {
  const fichier = path.join(DOSSIER, nom);
  const source = sharp(readFileSync(fichier)).flatten({ background: "#ffffff" });
  const { data, info } = await source.clone().raw().toBuffer({ resolveWithObject: true });
  const { width: l, height: h, channels: c } = info;

  // Le losange |x - xc| + |y - yc| <= r devient un carré dans le repère u = x + y, v = x - y
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * c;
      if (data[i] < SEUIL_BLANC || data[i + 1] < SEUIL_BLANC || data[i + 2] < SEUIL_BLANC) {
        const u = x + y, v = x - y;
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
    }
  }
  if (uMin === Infinity) throw new Error(`Aucun article repéré dans ${nom} (image entièrement blanche ?)`);

  const rayon = Math.max(uMax - uMin, vMax - vMin) / 2;
  const uc = (uMin + uMax) / 2, vc = (vMin + vMax) / 2;
  const xc = (uc + vc) / 2, yc = (uc - vc) / 2;
  const cote = Math.ceil(2 * rayon * (1 + MARGE));
  const gauche = Math.round(xc - cote / 2), haut = Math.round(yc - cote / 2);

  // Image déjà recadrée (carrée, à la bonne taille, article centré) : on n'y touche pas,
  // pour ne pas l'enregistrer à nouveau et perdre un peu de qualité à chaque fois
  const dejaFaite = l === TAILLE && h === TAILLE && Math.abs(cote - TAILLE) <= TAILLE * 0.03
    && Math.abs(xc - TAILLE / 2) <= TAILLE * 0.03 && Math.abs(yc - TAILLE / 2) <= TAILLE * 0.03;
  if (dejaFaite) return { nom, cote, l, h, inchangee: true };

  // Marge blanche autour de l'image si le carré dépasse ses bords
  const marge = Math.max(0, -gauche, -haut, gauche + cote - l, haut + cote - h);
  const agrandie = await source
    .clone()
    .extend({ top: marge, bottom: marge, left: marge, right: marge, background: "#ffffff" })
    .toBuffer();
  const resultat = await sharp(agrandie)
    .extract({ left: gauche + marge, top: haut + marge, width: cote, height: cote })
    .resize(TAILLE, TAILLE)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  await sharp(resultat).toFile(fichier);
  return { nom, cote, l, h };
}

for (const nom of images) {
  const r = await recadrer(nom);
  console.log(r.inchangee ? `· ${r.nom} : déjà recadrée` : `✓ ${r.nom} recadrée (losange de ${r.cote} px dans une image de ${r.l} × ${r.h})`);
}
