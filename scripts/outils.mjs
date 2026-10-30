// Outils partagés par les scripts de vérification : petit serveur web local pour dist/
// et recherche d'un navigateur Chrome (ou Edge) installé sur l'ordinateur.

import { createServer } from "node:http";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

/** Démarre un serveur local qui sert le dossier indiqué. Renvoie { url, fermer }. */
export async function servirDossier(dossier = "dist", port = 0) {
  const racine = path.resolve(dossier);
  const serveur = createServer(async (requete, reponse) => {
    try {
      let chemin = decodeURIComponent(new URL(requete.url, "http://localhost").pathname);
      if (chemin.endsWith("/")) chemin += "index.html";
      let fichier = path.join(racine, chemin);
      if (!fichier.startsWith(racine)) throw new Error("interdit");
      if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = path.join(fichier, "index.html");
      const contenu = await readFile(fichier);
      reponse.writeHead(200, { "Content-Type": TYPES[path.extname(fichier).toLowerCase()] || "application/octet-stream" });
      reponse.end(contenu);
    } catch {
      const page404 = path.join(racine, "404.html");
      reponse.writeHead(404, { "Content-Type": TYPES[".html"] });
      reponse.end(existsSync(page404) ? await readFile(page404) : "Introuvable");
    }
  });
  await new Promise((resoudre) => serveur.listen(port, "127.0.0.1", resoudre));
  const { port: portReel } = serveur.address();
  return { url: `http://127.0.0.1:${portReel}`, fermer: () => new Promise((r) => serveur.close(r)) };
}

/** Chemin d'un navigateur Chrome ou Edge installé (ou variable CHROME_PATH). */
export function trouverNavigateur() {
  const candidats = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const trouve = candidats.find((chemin) => existsSync(chemin));
  if (!trouve) {
    throw new Error("Aucun navigateur Chrome ou Edge trouvé. Indique son chemin dans la variable CHROME_PATH.");
  }
  return trouve;
}

/** Liste des pages HTML générées, sous forme d'URL relatives (/, /le-club/, /404.html…). */
export function listerPages(dossier = "dist") {
  const pages = [];
  const parcourir = (repertoire) => {
    for (const nom of readdirSync(repertoire)) {
      const complet = path.join(repertoire, nom);
      if (statSync(complet).isDirectory()) {
        if (nom !== "assets") parcourir(complet);
      } else if (nom.endsWith(".html")) {
        const relatif = "/" + path.relative(dossier, complet).split(path.sep).join("/");
        pages.push(relatif.endsWith("/index.html") ? relatif.slice(0, -"index.html".length) : relatif);
      }
    }
  };
  parcourir(dossier);
  return pages.sort();
}
