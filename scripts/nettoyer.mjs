// Supprime le dossier dist/ (site généré). Le prochain « npm run build » le recrée entièrement.
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
console.log("Dossier dist/ supprimé.");
