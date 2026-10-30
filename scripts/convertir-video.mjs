// Convertit le GIF d'ouverture (sources/ouverture_loop.gif) en vidéos MP4 et WebM
// en boucle, muettes, plus une image fixe (poster) affichée avant la lecture
// ou à la place de la vidéo quand le visiteur a demandé de réduire les animations.
//
// Nécessite ffmpeg (https://ffmpeg.org). À ne relancer que si le GIF change :
// les fichiers produits sont déjà enregistrés dans le projet.
//
//   npm run video

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SOURCE = "sources/ouverture_loop.gif";
const DOSSIER_VIDEO = "src/assets/video";
const POSTER = "src/assets/img/ouverture_poster.jpg";

// Image du GIF qui sert de poster : la 21e (éclairs bien visibles).
// La vidéo démarre sur cette même image pour que le passage poster → vidéo soit invisible.
const IMAGE_POSTER = 20; // numérotation à partir de 0
const DEBUT_BOUCLE = 1.68; // secondes : position de cette image dans le GIF

// Le GIF a des durées d'image variables : on le passe à cadence fixe,
// puis on fait commencer la boucle sur l'image du poster.
const filtre = [
  "[0:v]fps=100/7,split[x][y]",
  `[x]trim=start=${DEBUT_BOUCLE},setpts=PTS-STARTPTS[a]`,
  `[y]trim=end=${DEBUT_BOUCLE},setpts=PTS-STARTPTS[b]`,
  "[a][b]concat=n=2:v=1:a=0,format=yuv420p[v]",
].join(";");

function ffmpeg(args) {
  const resultat = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (resultat.error) {
    console.error(`ffmpeg introuvable (${resultat.error.message}). Installe ffmpeg ou indique son chemin dans la variable FFMPEG.`);
    process.exit(1);
  }
  if (resultat.status !== 0) process.exit(resultat.status);
}

mkdirSync(DOSSIER_VIDEO, { recursive: true });

console.log("MP4 (H.264)…");
ffmpeg(["-i", SOURCE, "-filter_complex", filtre, "-map", "[v]", "-an",
  "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart",
  `${DOSSIER_VIDEO}/ouverture.mp4`]);

console.log("WebM (VP9)…");
ffmpeg(["-i", SOURCE, "-filter_complex", filtre, "-map", "[v]", "-an",
  "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
  `${DOSSIER_VIDEO}/ouverture.webm`]);

console.log("Poster…");
ffmpeg(["-i", SOURCE, "-vf", `select=eq(n\\,${IMAGE_POSTER})`, "-frames:v", "1", "-q:v", "2", POSTER]);

console.log("Terminé.");
