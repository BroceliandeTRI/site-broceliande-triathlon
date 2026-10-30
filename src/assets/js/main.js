// Brocéliande Triathlon : petits comportements du site (sans bibliothèque).
// 1. Menu burger  2. Semaine type  3. Compte à rebours  4. Vidéo d’ouverture  5. Formulaire
// 6. Publications Facebook et Instagram (après l’accord du visiteur)  7. Frise de l’agenda
// 8. Fenêtres à la demande  9. Vidéo Facebook du triathlon

(function () {
  "use strict";

  /* ---------- 1. Menu burger (sous 1100 px) ---------- */
  var enTete = document.querySelector("[data-en-tete]");
  var burger = document.querySelector("[data-burger]");
  var menu = document.querySelector("[data-menu]");
  var ecranBurger = window.matchMedia("(max-width: 1099px)");

  function elementsFocusables() {
    return [burger].concat(Array.prototype.slice.call(menu.querySelectorAll("a[href], button:not([disabled])")));
  }

  function basculerFond(inerte) {
    ["main", "footer.pied"].forEach(function (selecteur) {
      var element = document.querySelector(selecteur);
      if (element) element.inert = inerte;
    });
  }

  function ouvrirMenu() {
    enTete.classList.add("menu-ouvert");
    document.documentElement.classList.add("menu-ouvert-page");
    burger.setAttribute("aria-expanded", "true");
    basculerFond(true);
    var premierLien = menu.querySelector("a[href]");
    if (premierLien) premierLien.focus();
  }

  function fermerMenu(rendreFocus) {
    enTete.classList.remove("menu-ouvert");
    document.documentElement.classList.remove("menu-ouvert-page");
    burger.setAttribute("aria-expanded", "false");
    basculerFond(false);
    if (rendreFocus) burger.focus();
  }

  if (enTete && burger && menu) {
    burger.addEventListener("click", function () {
      if (burger.getAttribute("aria-expanded") === "true") fermerMenu(false);
      else ouvrirMenu();
    });

    document.addEventListener("keydown", function (evenement) {
      if (burger.getAttribute("aria-expanded") !== "true") return;

      if (evenement.key === "Escape") {
        evenement.preventDefault();
        fermerMenu(true);
        return;
      }

      // Piège du focus : Tab reste dans le bouton et le panneau du menu
      if (evenement.key === "Tab") {
        var focusables = elementsFocusables();
        var premier = focusables[0];
        var dernier = focusables[focusables.length - 1];
        if (evenement.shiftKey && document.activeElement === premier) {
          evenement.preventDefault();
          dernier.focus();
        } else if (!evenement.shiftKey && document.activeElement === dernier) {
          evenement.preventDefault();
          premier.focus();
        }
      }
    });

    // Retour à l'affichage ordinateur : on referme le panneau
    var auChangement = function (requete) {
      if (!requete.matches && burger.getAttribute("aria-expanded") === "true") fermerMenu(false);
    };
    if (ecranBurger.addEventListener) ecranBurger.addEventListener("change", auChangement);
    else if (ecranBurger.addListener) ecranBurger.addListener(auChangement);
  }

  /* ---------- 2. Semaine type : bascule octobre – avril / mai – septembre ---------- */
  var boutonsSaison = document.querySelectorAll("[data-saison]");
  Array.prototype.forEach.call(boutonsSaison, function (bouton) {
    bouton.addEventListener("click", function () {
      var saison = bouton.getAttribute("data-saison");
      Array.prototype.forEach.call(boutonsSaison, function (autre) {
        autre.setAttribute("aria-pressed", autre === bouton ? "true" : "false");
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-saison-panneau]"), function (panneau) {
        panneau.hidden = panneau.getAttribute("data-saison-panneau") !== saison;
      });
    });
  });

  /* ---------- 3. Compte à rebours « J-xxx » (jours de calendrier, heure de Paris) ---------- */
  function jourParis(date) {
    var texte = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
    var morceaux = texte.split("-");
    return Date.UTC(+morceaux[0], +morceaux[1] - 1, +morceaux[2]);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-compte-a-rebours]"), function (element) {
    var cible = new Date(element.getAttribute("data-compte-a-rebours"));
    if (isNaN(cible)) return;
    try {
      var jours = Math.round((jourParis(cible) - jourParis(new Date())) / 86400000);
      element.textContent = String(Math.max(0, jours));
    } catch (erreur) {
      // On garde la valeur calculée à la génération du site
    }
  });

  /* ---------- 4. Vidéo d'ouverture (jamais si le visiteur réduit les animations) ---------- */
  var video = document.querySelector("[data-video]");
  var boutonPause = document.querySelector("[data-video-pause]");
  var mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)");

  function afficherEtat() {
    var enPause = video.paused;
    boutonPause.setAttribute("data-etat", enPause ? "pause" : "lecture");
    boutonPause.setAttribute("aria-label", enPause ? "Relancer l'animation" : "Mettre l'animation en pause");
  }

  function chargerVideo() {
    // La lecture démarre d'elle-même (vidéo muette) dès que les données sont prêtes
    video.autoplay = true;
    [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (format) {
      var adresse = video.getAttribute("data-" + format[0]);
      if (!adresse) return;
      var source = document.createElement("source");
      source.src = adresse;
      source.type = format[1];
      video.appendChild(source);
    });
  }

  if (video && boutonPause) {
    video.addEventListener("playing", function () { video.classList.add("est-en-lecture"); });
    video.addEventListener("play", afficherEtat);
    video.addEventListener("pause", afficherEtat);

    if (!mouvementReduit.matches) {
      chargerVideo();
      boutonPause.hidden = false;
    }

    boutonPause.addEventListener("click", function () {
      if (video.paused) {
        var promesse = video.play();
        if (promesse && promesse.catch) promesse.catch(afficherEtat);
      } else {
        video.pause();
      }
    });

    var auChangementMouvement = function (requete) {
      if (requete.matches) {
        video.autoplay = false;
        video.pause();
        video.classList.remove("est-en-lecture");
        boutonPause.hidden = true;
      }
    };
    if (mouvementReduit.addEventListener) mouvementReduit.addEventListener("change", auChangementMouvement);
    else if (mouvementReduit.addListener) mouvementReduit.addListener(auChangementMouvement);
  }

  /* ---------- 5. Formulaire : le champ piège bloque les envois automatiques ---------- */
  var formulaire = document.querySelector("[data-formulaire]");
  if (formulaire) {
    formulaire.addEventListener("submit", function (evenement) {
      var piege = formulaire.querySelector("[name='site_web']");
      if (piege && piege.value) evenement.preventDefault();
    });
  }

  /* ---------- 6. Contenus de Meta (fil Facebook, publications Instagram), seulement après accord ---------- */
  // Un seul accord pour Facebook et Instagram, demandé par un bandeau (Refuser / Accepter) sur les pages
  // concernées. Rien n'est chargé depuis Meta avant l'acceptation. Le choix, accepté ou refusé, est gardé
  // 6 mois dans le navigateur (durée recommandée par la CNIL) et peut être changé à tout moment.
  var CLE_ACCORD_META = "bt-accord-meta";
  var DUREE_ACCORD = 182 * 24 * 60 * 60 * 1000;

  function lireChoixMeta() {
    try {
      var choix = JSON.parse(window.localStorage.getItem(CLE_ACCORD_META));
      if (choix && Date.now() - choix.date < DUREE_ACCORD) return choix.choix;
    } catch (erreur) {
      // stockage indisponible
    }
    return null;
  }
  function enregistrerChoixMeta(choix) {
    try {
      if (choix) window.localStorage.setItem(CLE_ACCORD_META, JSON.stringify({ choix: choix, date: Date.now() }));
      else window.localStorage.removeItem(CLE_ACCORD_META);
    } catch (erreur) {
      // Navigation privée ou stockage bloqué : le choix vaut seulement pour cette page
    }
  }

  // Carrousel : les publications défilent une par une (flèches, balayage sur téléphone, clavier)
  var mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)");
  function creerCarrousel(cadre, libelle, nombre) {
    var piste = document.createElement("div");
    piste.className = "carrousel";
    cadre.appendChild(piste);
    if (nombre < 2) return piste;

    piste.setAttribute("role", "region");
    piste.setAttribute("aria-label", libelle);
    piste.setAttribute("tabindex", "0");
    var commandes = document.createElement("div");
    commandes.className = "carrousel__commandes";
    commandes.innerHTML =
      '<button class="carrousel__bouton" type="button" data-sens="-1" aria-label="Publication précédente"><span aria-hidden="true">←</span></button>' +
      '<span class="carrousel__position" aria-live="polite"></span>' +
      '<button class="carrousel__bouton" type="button" data-sens="1" aria-label="Publication suivante"><span aria-hidden="true">→</span></button>';
    cadre.appendChild(commandes);
    var position = commandes.querySelector(".carrousel__position");
    var boutons = commandes.querySelectorAll("[data-sens]");

    function indexCourant() { return Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth)); }
    function mettreAJour() {
      var i = indexCourant();
      position.textContent = "Publication " + (i + 1) + " sur " + nombre;
      boutons[0].disabled = i === 0;
      boutons[1].disabled = i >= nombre - 1;
    }
    commandes.addEventListener("click", function (evenement) {
      var bouton = evenement.target.closest("[data-sens]");
      if (!bouton) return;
      var cible = Math.max(0, Math.min(nombre - 1, indexCourant() + Number(bouton.getAttribute("data-sens"))));
      piste.scrollTo({ left: cible * piste.clientWidth, behavior: mouvementReduit.matches ? "auto" : "smooth" });
    });
    var enAttente = false;
    piste.addEventListener("scroll", function () {
      if (enAttente) return;
      enAttente = true;
      window.requestAnimationFrame(function () { enAttente = false; mettreAJour(); });
    });
    mettreAJour();
    return piste;
  }
  function ajouterDiapo(piste) {
    var diapo = document.createElement("div");
    diapo.className = "carrousel__diapo";
    piste.appendChild(diapo);
    return diapo;
  }

  // Publications Facebook : code d'intégration officiel de Meta (SDK), une publication par carte.
  // Le fil complet de la page (plugin Page) n'affiche plus les publications aux visiteurs
  // qui ne sont pas connectés à Facebook : on intègre donc des publications choisies.
  var SDK_FACEBOOK = "https://connect.facebook.net/fr_FR/sdk.js#xfbml=1&version=v21.0";
  function afficherFacebook(cadre, bloc) {
    // Bloc pas encore visible (largeur nulle) : les publications sont créées dès qu'il apparaît, à la bonne largeur
    if (!bloc.clientWidth && window.ResizeObserver) {
      if (cadre.hasAttribute("data-en-attente")) return;
      cadre.setAttribute("data-en-attente", "");
      var observateur = new ResizeObserver(function () {
        if (!bloc.clientWidth) return;
        observateur.disconnect();
        cadre.removeAttribute("data-en-attente");
        if (!cadre.hidden && !cadre.childElementCount) afficherFacebook(cadre, bloc);
      });
      observateur.observe(bloc);
      return;
    }
    var adresses = [];
    try { adresses = JSON.parse(bloc.getAttribute("data-publications")) || []; } catch (erreur) { /* liste vide */ }
    var pisteFacebook = creerCarrousel(cadre, "Publications Facebook du club", adresses.length);
    adresses.forEach(function (adresse) {
      var publication = document.createElement("div");
      publication.className = "fb-post";
      publication.setAttribute("data-href", adresse);
      publication.setAttribute("data-width", "auto");
      publication.setAttribute("data-show-text", "true");
      ajouterDiapo(pisteFacebook).appendChild(publication);
    });

    // Les cadres créés par Facebook reçoivent un titre pour les lecteurs d'écran
    if (window.MutationObserver) {
      new MutationObserver(function () {
        Array.prototype.forEach.call(cadre.querySelectorAll("iframe"), function (iframe) {
          if (iframe.title !== "Publication Facebook du club") iframe.title = "Publication Facebook du club";
        });
      }).observe(cadre, { childList: true, subtree: true });
    }

    // Les scripts de Facebook et d'Instagram se gênent s'ils démarrent en même temps :
    // quand la page affiche aussi Instagram, Facebook attend qu'Instagram soit prêt (8 secondes au plus).
    var debut = Date.now();
    (function attendreInstagram() {
      var instagramAttendu = document.querySelector('[data-integration="instagram"]') && !(window.instgrm && window.instgrm.Embeds);
      if (instagramAttendu && Date.now() - debut < 8000) {
        setTimeout(attendreInstagram, 200);
        return;
      }
      chargerFacebook(cadre);
    })();
  }
  function chargerFacebook(cadre) {
    if (window.FB && window.FB.XFBML) {
      window.FB.XFBML.parse(cadre);
    } else if (!document.querySelector("script[data-facebook-sdk]")) {
      if (!document.getElementById("fb-root")) {
        var racine = document.createElement("div");
        racine.id = "fb-root";
        document.body.appendChild(racine);
      }
      var script = document.createElement("script");
      script.src = SDK_FACEBOOK;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.setAttribute("data-facebook-sdk", "");
      document.body.appendChild(script);
    }
  }

  // Publications Instagram : code d'intégration officiel de Meta (embed.js), une publication par carte
  function afficherInstagram(cadre, bloc) {
    var adresses = [];
    try { adresses = JSON.parse(bloc.getAttribute("data-publications")) || []; } catch (erreur) { /* liste vide */ }
    var pisteInstagram = creerCarrousel(cadre, "Publications Instagram du club", adresses.length);
    adresses.forEach(function (adresse) {
      var citation = document.createElement("blockquote");
      citation.className = "instagram-media";
      citation.setAttribute("data-instgrm-permalink", adresse);
      citation.setAttribute("data-instgrm-version", "14");
      // Style du code d'intégration officiel : largeur fluide de 326 à 540 px
      citation.style.cssText = "background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,.5),0 1px 10px 0 rgba(0,0,0,.15);margin:1px;max-width:540px;min-width:326px;padding:0;width:calc(100% - 2px);";
      var lien = document.createElement("a");
      lien.href = adresse;
      lien.textContent = "Voir cette publication sur Instagram";
      citation.appendChild(lien);
      ajouterDiapo(pisteInstagram).appendChild(citation);
    });

    // Les cadres créés par Instagram reçoivent un titre pour les lecteurs d'écran
    if (window.MutationObserver) {
      new MutationObserver(function () {
        Array.prototype.forEach.call(cadre.querySelectorAll("iframe:not([title])"), function (iframe) {
          iframe.title = "Publication Instagram du club";
        });
      }).observe(cadre, { childList: true, subtree: true });
    }

    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    } else if (!document.querySelector("script[data-instagram-embed]")) {
      chargerScriptInstagram("");
      // Il arrive que le script d'Instagram se charge sans démarrer : on le recharge une fois
      setTimeout(function () {
        if ((window.instgrm && window.instgrm.Embeds) || cadre.hidden || cadre.querySelector("iframe")) return;
        var ancien = document.querySelector("script[data-instagram-embed]");
        if (ancien) ancien.remove();
        chargerScriptInstagram("?relance=1");
      }, 5000);
    }
  }
  function chargerScriptInstagram(suffixe) {
    var script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js" + suffixe;
    script.async = true;
    script.setAttribute("data-instagram-embed", "");
    script.onload = function () {
      if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
    };
    document.body.appendChild(script);
  }

  var AFFICHAGES = { facebook: afficherFacebook, instagram: afficherInstagram };
  var blocsMeta = Array.prototype.slice.call(document.querySelectorAll("[data-integration]"));
  var bandeauMeta = document.querySelector("[data-bandeau-meta]");
  var annonceMeta = document.querySelector("[data-annonce-meta]");

  function appliquerChoixMeta(choix) {
    var accepte = choix === "oui";
    blocsMeta.forEach(function (bloc) {
      var accord = bloc.querySelector("[data-integration-accord]");
      var vignettes = bloc.querySelector("[data-integration-vignettes]");
      var cadre = bloc.querySelector("[data-integration-cadre]");
      var retrait = bloc.querySelector("[data-integration-retrait]");
      var afficher = AFFICHAGES[bloc.getAttribute("data-integration")];
      if (!cadre || !afficher) return;
      if (!accepte) cadre.innerHTML = "";
      cadre.hidden = !accepte;
      if (retrait) retrait.hidden = !accepte;
      if (accord) accord.hidden = accepte;
      if (vignettes) vignettes.hidden = accepte;
      // La largeur du bloc est mesurée une fois le cadre visible
      if (accepte && !cadre.childElementCount) afficher(cadre, bloc);
    });
  }

  document.addEventListener("click", function (evenement) {
    var bouton = evenement.target.closest("[data-accord-meta]");
    if (!bouton) return;
    var choix = bouton.getAttribute("data-accord-meta");
    enregistrerChoixMeta(choix);
    if (bandeauMeta) bandeauMeta.hidden = true;
    appliquerChoixMeta(choix);
    if (annonceMeta) {
      annonceMeta.textContent = choix === "oui"
        ? "Publications Facebook et Instagram affichées."
        : "Les contenus Facebook et Instagram ne sont pas affichés.";
    }
    if (choix === "non" && bouton.closest("[data-integration-retrait]")) {
      var accepter = document.querySelector("[data-integration-accord] [data-accord-meta=\"oui\"]");
      if (accepter) accepter.focus();
    }
  });

  // Page Confidentialité : effacer son choix (il sera redemandé)
  Array.prototype.forEach.call(document.querySelectorAll("[data-effacer-choix-meta]"), function (bouton) {
    bouton.addEventListener("click", function () {
      enregistrerChoixMeta(null);
      var message = document.querySelector("[data-choix-efface]");
      if (message) message.hidden = false;
    });
  });

  var choixMeta = lireChoixMeta();
  if (choixMeta === "oui") appliquerChoixMeta("oui");
  else if (choixMeta === null && bandeauMeta && blocsMeta.length) bandeauMeta.hidden = false;

  /* ---------- 7. Frise de l'agenda : rendez-vous passés et repère « aujourd'hui » ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-frise]"), function (frise) {
    var etapes = Array.prototype.slice.call(frise.querySelectorAll("[data-date]"));
    var n = etapes.length;
    if (!n) return;
    var maintenant = new Date();
    var passes = 0;
    etapes.forEach(function (etape, i) {
      var morceaux = (etape.getAttribute("data-date") || "").split("-").map(Number);
      if (!morceaux[0]) return;
      var fin = morceaux[2]
        ? new Date(morceaux[0], morceaux[1] - 1, morceaux[2], 23, 59)
        : new Date(morceaux[0], morceaux[1], 0, 23, 59);
      if (fin < maintenant) passes = i + 1;
    });
    etapes.forEach(function (etape, i) { etape.classList.toggle("est-passe", i < passes); });
    var position = function (i) { return ((i + 0.5) / n) * 100; };
    var pourcentage = passes === 0 ? position(0) / 2 : passes >= n ? 100 : (position(passes - 1) + position(passes)) / 2;
    frise.style.setProperty("--avancement", pourcentage + "%");

    // Frise verticale (petite largeur, colonne de l'accueil) : le remplissage s'arrête
    // à mi-chemin entre le dernier rendez-vous passé et le suivant, d'après leur position réelle.
    var piste = frise.querySelector(".frise__piste");
    var points = etapes.map(function (etape) { return etape.querySelector(".frise__point"); });
    function ajusterVertical() {
      if (!piste || piste.offsetHeight <= piste.offsetWidth) {
        frise.style.setProperty("--avancement", pourcentage + "%");
        return;
      }
      var haut = piste.getBoundingClientRect().top;
      var centre = function (point) { var r = point.getBoundingClientRect(); return r.top + r.height / 2 - haut; };
      var y = passes === 0 ? 0 : passes >= n ? piste.offsetHeight : (centre(points[passes - 1]) + centre(points[passes])) / 2;
      frise.style.setProperty("--avancement", Math.max(0, Math.min(100, (y / piste.offsetHeight) * 100)) + "%");
    }
    ajusterVertical();
    if (window.ResizeObserver) new ResizeObserver(ajusterVertical).observe(frise);
  });

  /* ---------- 8. Fenêtres à la demande (horaires de la piscine) ---------- */
  // Le bouton reste masqué sans JavaScript : le lien vers le site de la piscine prend le relais.
  Array.prototype.forEach.call(document.querySelectorAll("[data-ouvrir-dialogue]"), function (bouton) {
    var dialogue = document.getElementById(bouton.getAttribute("data-ouvrir-dialogue"));
    if (!dialogue || typeof dialogue.showModal !== "function") return;
    bouton.hidden = false;
    bouton.setAttribute("aria-haspopup", "dialog");
    bouton.addEventListener("click", function () { dialogue.showModal(); });
    // Fermeture : bouton, touche Échap (native) ou clic sur le fond sombre ; le focus revient au bouton
    Array.prototype.forEach.call(dialogue.querySelectorAll("[data-fermer-dialogue]"), function (fermer) {
      fermer.addEventListener("click", function () { dialogue.close(); });
    });
    dialogue.addEventListener("click", function (evenement) {
      if (evenement.target === dialogue) dialogue.close();
    });
    dialogue.addEventListener("close", function () { bouton.focus(); });
  });

  /* ---------- 9. Vidéo Facebook (vitrine du triathlon) : le lecteur de Meta n'est chargé qu'au clic ---------- */
  // Sans JavaScript, l'image mène à la vidéo sur Facebook. Avec, le lecteur s'ouvre dans la page.
  Array.prototype.forEach.call(document.querySelectorAll("[data-video-facebook]"), function (bloc) {
    var facade = bloc.querySelector(".video-fb__facade");
    var ecran = bloc.querySelector(".video-fb__ecran");
    facade.addEventListener("click", function (evenement) {
      evenement.preventDefault();
      var largeur = Math.min(1280, Math.round(ecran.clientWidth)) || 640;
      var iframe = document.createElement("iframe");
      iframe.className = "video-fb__lecteur";
      iframe.src = "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(bloc.getAttribute("data-video-facebook")) +
        "&show_text=false&autoplay=true&width=" + largeur;
      iframe.title = bloc.getAttribute("data-titre") || "Vidéo Facebook";
      iframe.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share");
      iframe.setAttribute("allowfullscreen", "");
      facade.hidden = true;
      ecran.appendChild(iframe);
      iframe.focus();
    });
  });
  // « Ne plus afficher les contenus Facebook et Instagram » referme aussi les vidéos
  document.addEventListener("click", function (evenement) {
    if (!evenement.target.closest("[data-accord-meta=\"non\"], [data-effacer-choix-meta]")) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-video-facebook]"), function (bloc) {
      var lecteur = bloc.querySelector(".video-fb__lecteur");
      if (lecteur) lecteur.remove();
      bloc.querySelector(".video-fb__facade").hidden = false;
    });
  });
})();
