// Publications Facebook et Instagram les plus récentes, récupérées automatiquement à chaque génération
// du site grâce à l'API de Meta (Graph API). Sur GitHub, le site est régénéré chaque nuit.
//
// Il faut pour cela trois clés, rangées dans les secrets du dépôt GitHub (voir guides/GUIDE_GESTION.md, section 3.7) :
//   META_JETON_PAGE     jeton d'accès de la page Facebook du club
//   META_ID_PAGE        identifiant de la page Facebook
//   META_ID_INSTAGRAM   identifiant du compte Instagram professionnel relié à la page
// Sans ces clés, ou en cas d'erreur, le site utilise les listes écrites à la main dans publications.json.

const VERSION_API = "v21.0";
const NOMBRE = 3;

async function lire(adresse) {
  const reponse = await fetch(adresse, { signal: AbortSignal.timeout(15000) });
  const donnees = await reponse.json();
  if (!reponse.ok || donnees.error) throw new Error(donnees.error?.message || `réponse ${reponse.status}`);
  return donnees.data || [];
}

export default async function () {
  const jeton = process.env.META_JETON_PAGE;
  const page = process.env.META_ID_PAGE;
  const instagram = process.env.META_ID_INSTAGRAM;
  const resultat = { facebook: [], instagram: [] };
  if (!jeton) return resultat;

  const base = `https://graph.facebook.com/${VERSION_API}`;
  const cle = `access_token=${encodeURIComponent(jeton)}`;

  if (page) {
    try {
      const publications = await lire(`${base}/${encodeURIComponent(page)}/posts?fields=permalink_url&limit=${NOMBRE}&${cle}`);
      resultat.facebook = publications.map((p) => p.permalink_url).filter(Boolean);
      console.log(`[publications] Facebook : ${resultat.facebook.length} publication(s) récupérée(s)`);
    } catch (erreur) {
      console.warn(`[publications] Facebook non récupéré (${erreur.message}) : liste de publications.json utilisée`);
    }
  }

  if (instagram) {
    try {
      const publications = await lire(`${base}/${encodeURIComponent(instagram)}/media?fields=permalink&limit=${NOMBRE}&${cle}`);
      resultat.instagram = publications.map((p) => p.permalink).filter(Boolean);
      console.log(`[publications] Instagram : ${resultat.instagram.length} publication(s) récupérée(s)`);
    } catch (erreur) {
      console.warn(`[publications] Instagram non récupéré (${erreur.message}) : liste de publications.json utilisée`);
    }
  }

  return resultat;
}
