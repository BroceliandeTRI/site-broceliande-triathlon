// Données structurées (schema.org) de la page d'accueil : le club et le Triathlon de Brocéliande.
// Elles aident les moteurs de recherche à afficher le club et la date de l'évènement.
// Tout vient des autres fichiers de données : rien à modifier ici.

import site from "./site.json" with { type: "json" };
import reseaux from "./reseaux.json" with { type: "json" };
import evenements from "./evenements.json" with { type: "json" };

const url = (process.env.URL_SITE || site.url).replace(/\/$/, "");

export default [
  {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: site.nom,
    url: `${url}/`,
    email: site.email,
    sport: "Triathlon",
    foundingDate: "2008-09-27",
    logo: `${url}/assets/img/icone-512.png`,
    address: { "@type": "PostalAddress", addressLocality: "Montfort-sur-Meu", addressRegion: "Bretagne", addressCountry: "FR" },
    sameAs: reseaux.map((reseau) => reseau.url),
  },
  {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: evenements.triathlon.nom,
    sport: "Triathlon",
    startDate: evenements.triathlon.depart,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${url}/evenements/#triathlon`,
    location: {
      "@type": "Place",
      name: "Lac de Trémelin",
      address: { "@type": "PostalAddress", addressLocality: "Iffendic", addressRegion: "Bretagne", addressCountry: "FR" },
    },
    organizer: { "@type": "SportsClub", name: site.nom, url: `${url}/` },
  },
];
