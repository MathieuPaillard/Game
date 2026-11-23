# Pistes d'amélioration

En novembre 2026, une équipe de six agents a testé le jeu et proposé des améliorations. Leurs rôles :
- vérifier les règles ;
- vérifier le serveur ;
- jouer dans le navigateur ;
- juger l'interface ;
- étudier les mécaniques et l'équilibrage ;
- juger le design et les animations.

Ce document garde les **propositions qui restent à décider ou à faire**. Les bugs qu'ils ont trouvés sont déjà corrigés (voir la fin).

Chaque piste a un identifiant. Pour en lancer une, il suffit de dire par exemple « fais I3 et D2 ». Quand une piste est décidée, elle passe dans `conception.md` (Décidé ou Proposition) et sort d'ici.

Coût : **petit** (une séance), **moyen** (quelques séances), **gros** (un chantier). Les chiffres d'équilibrage viennent de simulations (`npm run simulation` et des scripts de l'agent des mécaniques).

## Les questions à trancher d'abord

1. **Les camps de monstres.** Un camp se réattaque dès la victoire, sans attendre. Depuis la correction de la charge, une armée ne rapporte que ce qu'elle porte. Mais réattaquer l'Antre du troll rapporte encore environ deux fois la production de la cité.
   - Proposition : un camp vaincu se repeuple après un moment, par exemple 10 minutes par niveau du camp. Le butin devient un bonus, pas un métier.
2. **Le dragon : une arme ou un soutien ?** Dans un combat, les coups se répartissent par tête. Le dragon ne compte que pour une : il reçoit très peu de coups et n'est presque jamais blessé. Escorté de 20 guerriers, il bat l'Antre du troll, qui en demande 45 sans lui.
   - Proposition : le faire compter pour plusieurs têtes (par exemple 40), exiger une escorte minimale (10 troupes par niveau), puis rééquilibrer son attaque.
3. **La durée de la progression.** Aujourd'hui, tous les bâtiments sont au niveau 10 en 22 heures de jeu environ, et toutes les recherches tiennent en 43 minutes.
   - Faut-il des niveaux au-delà de 10, avec des chantiers de plusieurs heures (« je lance, je reviens ce soir ») ?
4. **Un plafond de stockage (entrepôts) ?** Les réserves n'ont aucune limite. Les raids pillent donc à peine (2 à 3 % d'une nuit), et la part que protège le Château ne compte plus.
   - Un plafond (environ 12 heures de production) donnerait du poids aux raids et au futur jeu entre joueurs.
5. **Les sorts : quelques minutes ou quelques heures ?** La Tour des mages n'est jamais construite par le joueur virtuel. Relancer un sort toutes les 10 minutes est une corvée, loin de l'esprit « la partie continue sans toi ».
   - Proposition : des sorts de production de 2 heures, et des sorts de combat inchangés.
6. **Prédire l'issue d'un combat ?** Les combats sont sans hasard : le jeu peut annoncer « Facile / Serré / Trop fort » avant d'attaquer (voir I8).
   - Faut-il une prédiction exacte, ou seulement approchée ?

## Interface (I)

Les deux défauts principaux :
- en paysage, le panneau cache l'action principale sous plusieurs écrans de défilement (la Caserne fait 7,5 écrans) ;
- le jeu dit quoi faire, mais ni où, ni avec quelles chances.

La maquette `maquettes/interface-panneau-caserne.png` montre I1, I2, I7 et I9.

### Gains rapides

| Id | Proposition | Coût |
|---|---|---|
| I1 | **L'action d'abord.** Dans le panneau d'un bâtiment, montrer d'abord sa fonction (entraîner, rechercher…), et replier l'amélioration en une ligne (« Niveau 4 · Améliorer (5 min) ▸ »). L'en-tête prend le nom du bâtiment, et les titres en double disparaissent (« RAPPORTS » + « Rapports de bataille »). | petit |
| I2 | **Un objectif qui dit où aller.** L'étiquette montre l'action (« Construis la Mine d'or »), et la page de l'objectif gagne un bouton « Y aller » qui ouvre le bon bâtiment ou la bonne cible. | petit à moyen |
| I3 | **Des cibles pour le doigt.** Étiquettes du HUD, choix du héros, réglettes et boutons d'au moins 44 px de haut (beaucoup font 30 à 34 px). Textes au moins 12 px (débits des ressources et libellés des boutons à 10–11 px). | petit |
| I4 | **L'écran de compte en paysage.** « Jouer sans compte » devient un vrai bouton, visible sans défiler. Aujourd'hui, c'est un petit lien deux écrans plus bas. | petit |
| I5 | **Des armées qui ont un nom.** « Armée d'Ysolde », « Armée 2 », plutôt que trois « Ton armée ». Le combat se résume en une ligne (« Manche 3 · tes troupes 82 % · loups 40 % »). | petit |
| I6 | **Clavier et grand écran.** Le HUD vient avant la carte dans l'ordre de tabulation, avec des raccourcis (C cité/alentours, H héros, R rapports). Sur ordinateur, le panneau s'élargit (il plafonne aujourd'hui à 24rem, et la grille à deux colonnes ne s'active jamais). | petit |

### Chantiers

| Id | Proposition | Coût |
|---|---|---|
| I7 | **Le panneau « une action sans défiler »** (maquette). Une barre collée en bas avec le coût et le bouton principal, et des onglets [Entraîner] [Améliorer]. La Caserne devient une rangée de tuiles d'unités, avec des raccourcis 10 / 25 / 50 / Max. Même modèle pour la fiche d'une cible et pour les héros. La Caserne passe de 2 214 px à environ 350 px. | moyen |
| I8 | **Estimer avant d'attaquer** (question 6) : une jauge « Facile / Serré / Trop fort » et les pertes estimées. | moyen |
| I9 | **La file des travaux.** Une seule étiquette résume les travaux (« 🔨 1/2 · ⚔️ 1 · 📜 1 »), qui se déplie en liste. Une étiquette dorée signale « Un chantier est libre ». Un message annonce « Ferme : niveau 3 terminé » quand un travail finit pendant qu'on joue. En milieu de partie, dix étiquettes d'émojis couvrent aujourd'hui la moitié de la carte. | moyen |
| I10 | **Le doigt de l'objectif.** Pour les dix premiers objectifs, un repère doré « Ici » montre l'élément à toucher, puis le bouton. | moyen |
| I11 | **La carte des alentours suit l'armée choisie.** Une flèche au bord de l'écran montre une bataille hors du cadre. | moyen |
| I12 | **Des rapports compacts.** Une ligne par rapport, à déplier. « Bon retour » gagne des liens « Voir le rapport », « Voir le raid ». | moyen |
| I13 | **Des notifications sur le téléphone** (avec l'appli Android) : chantier terminé, raid dans 5 minutes, siège. | gros |

## Mécaniques et équilibrage (M)

Le constat général :
- les 26 objectifs se terminent en 3 heures environ, avec des **guerriers seulement** ;
- ni les contres entre familles, ni les unités de race, ni la Tour des mages ne servent ;
- au-delà de 3 h 30, il reste peu à faire.

| Id | Proposition | Coût |
|---|---|---|
| M1 | **Varier les troupes.** Le guerrier est le moins cher contre 20 cibles sur 22. La raison : une armée qui gagne perd à peu près la même chose quelle que soit sa taille, donc seule compte la vie achetée par ressource. Variante testée : `COUNTER_BONUS` 1,5 → 2, guerrier plus cher (40 nourriture + 20 bois), archers, cavaliers, mages, arbalétriers et druides plus résistants ou moins chers. La troupe la plus rentable dépend alors de la cible (archers sur 10 cibles, cavaliers sur 7…). Les mages et les arbalétriers demandent une seconde passe. | petit (chiffres) |
| M2 | **Des traits de monstres** qui demandent une composition : squelettes qui résistent aux guerriers, vouivres volantes que seuls les archers et les mages touchent pleinement, trolls qui se régénèrent. | moyen |
| M3 | **Des raids qui menacent vraiment** : chaque monstre emporte 120 ressources au lieu de 40, et les raids grossissent au-delà du Château 7. À voir avec la question 4. | petit |
| M4 | **Le rythme.** Le bois manque bien plus que le reste (scierie un peu plus forte). Les objectifs « N victoires » et « N raids » sont souvent déjà remplis quand ils apparaissent : les compter à partir de leur apparition, ou relever les seuils. L'Antre du troll fait attendre jusqu'à 2 heures sans rien de neuf à faire. | petit |
| M5 | **Une deuxième chaîne d'objectifs** : Château 7 à 10, la Tour des mages et un sort, l'unité de race, un deuxième héros, le Commandement, le dragon au niveau 5. | petit (données) |
| M6 | **Des contrats du jour** : trois défis tirés chaque jour (une bande de niveau 3, une récolte, un raid, un sort…). Ils se gardent jusqu'à trois jours, pour ne pas punir l'absence. C'est une raison de revenir chaque jour, qui fait servir tout le contenu. | moyen |
| M7 | **La famine** n'arrive jamais : une Ferme de niveau 6 nourrit 2 000 guerriers. Elle pourrait aussi retirer de la vie, pas seulement de l'attaque. Et les bonus d'attaque ne servent plus contre un adversaire déjà écrasé. | petit |
| M8 | **Les gisements** rapportent beaucoup (trois armées qui récoltent font 2,8 fois la cité) : les faire apparaître moins souvent. | petit |
| M9 | **Pour le multijoueur** : un grand assaut chaque semaine, annoncé 24 heures à l'avance et défendu plus tard avec les alliés ; un bouclier pour les débutants, perdu si l'on attaque un joueur. | gros |

## Design et animations (D)

Les mesures ont été faites sur un téléphone d'entrée de gamme simulé (processeur ralenti 4 à 6 fois). Les pulsations du siège et des raids sont déjà allégées ; il reste surtout le zoom.

La maquette `maquettes/cartes-quatre-pistes.png` montre D7 à D10.

### Technique

| Id | Proposition | Coût |
|---|---|---|
| D1 | **Le zoom saccade** (9 à 12 images par seconde au ralenti ×6). Chrome remet en page les quelque 110 émojis écrits en texte à chaque changement d'échelle. Dessiner les arbres avec un symbole SVG réutilisé (puis toutes les icônes, avec les futures images) fait remonter le zoom à 56–60 images par seconde. | petit, puis moyen |
| D2 | **Glisser la carte** : déplacer un calque d'un bloc pendant le geste, et ne recalculer la vue qu'au lâcher (52 → 59 images par seconde). | moyen |
| D3 | **Animer moins souvent** : une seule bouffée de ressource à la fois dans la cité (−54 % de travail), et des flammes en quelques pas. | petit |
| D4 | **Un réglage « Animations : pleines / économes / aucune »** dans le menu. Le mode économe est choisi d'office sur les appareils modestes. | petit |
| D5 | **Deux calques** : le décor fixe dessous, ce qui vit par-dessus. Les animations ne repeignent plus le décor. | moyen |
| D6 | **Les étiquettes gardent la même taille à l'écran** quel que soit le zoom : elles font 6 à 9 px carte dézoomée et 66 px au zoom maximal. Les sous-étiquettes se cachent quand on dézoome. | petit |
| D11 | **Avant l'appli Android.** Héberger les polices dans le projet : sans réseau, elles disparaissent. Les émojis 🪵 🪨 🪙 🪄 🪖 n'existent pas avant Android 11 et s'y afficheraient en carrés vides, ce qui pousse à passer vite aux images. Prévoir des images assez grandes (512 px pour les bâtiments). | petit |

### Artistique

| Id | Proposition | Coût |
|---|---|---|
| D7 | **Qui gagne ?** Une seule barre « balance des forces » au-dessus des épées, et un badge de manche différent du badge de niveau. À la fin, une bannière « Victoire ! » ou « Repli ». | petit à moyen |
| D8 | **Les moments forts, joués une fois** : chantier terminé (éclat doré, « Niveau 4 ! »), héros qui monte de niveau, éclosion, raid repéré, récompense qui vole vers la barre des ressources. Rien ne tourne en boucle. | moyen |
| D9 | **Le bâtiment grandit avec son niveau**, par paliers (1–4, 5–9, 10 et plus) : socle de terre, puis de pierre, puis terrasse et bannières aux couleurs de la race. | moyen |
| D10 | **Le jour et la nuit, puis les saisons**, par la seule palette : la nuit, fenêtres et feux de camp s'allument. | petit à moyen |
| D12 | **Moins de rouge en tirets** aux alentours : cinq tracés rouges ont cinq sens différents. Ronde en pointillés fins, zone d'aggro pleine et dessinée sous les repères, chemin du raid en chevrons. | petit |
| D13 | **Une cité moins schématique** : routes courbes vers une place, tours sur l'enceinte selon le niveau des Remparts, et plus tard une météo. | moyen |

## Serveur, avant la mise en ligne (S)

| Id | Proposition | Coût |
|---|---|---|
| S1 | **Limiter le débit par adresse IP** (inscriptions, connexions, ordres). Aujourd'hui, n'importe qui peut bloquer la connexion d'un joueur en tapant 10 mauvais mots de passe pour son nom : le verrou devrait porter sur le nom et l'adresse ensemble. | petit |
| S2 | **Des noms propres** : refuser les caractères invisibles, les mélanges d'alphabets (« Аrthur » avec un A cyrillique) et le « zalgo ». Traiter « ’ » comme « ' ». Refuser les mots de passe trop simples (8 espaces). | petit |
| S3 | **Une politique de sécurité du contenu (CSP)** et les polices hébergées sur le serveur (aujourd'hui, l'adresse de chaque visiteur part chez Google). | petit |
| S4 | **Pour l'hébergement** : un journal des requêtes, une sauvegarde chaque nuit de la base (`VACUUM INTO`), le HTTPS (par exemple avec Caddy) et la compression, CORS pour l'appli Android, un seul processus Node, et une purge des vieilles sessions. | petit |
| S5 | **Le compte** : changer son mot de passe, « se déconnecter partout », supprimer son compte (un droit garanti par le RGPD). | moyen |

## Règles : ce qui reste

| Id | Proposition | Coût |
|---|---|---|
| R1 | Une armée ne peut plus reprendre aussitôt le combat qu'elle mène. Mais « retraite vers un point, puis attaque » reste possible en deux ordres. Un script pourrait ainsi retenir un raid indéfiniment : il faudrait un court délai avant de réattaquer la même bande. | petit |
| R2 | Une armée qui rentre pendant un siège entre dans la cité sans défendre, et une armée envoyée contre l'assiégeant attend à côté. Faut-il qu'elle rejoigne la défense ? (à trancher) | moyen |
| R3 | Les troupes tombées mangent encore, et comptent pour l'objectif « troupes », jusqu'à la fin de la bataille : il faudrait mettre l'armée à jour à chaque manche. | petit |
| R4 | Ajouter aux tests le « joueur aléatoire » de l'agent des règles, en version courte (2 parties, quelques secondes). Il vérifie d'un coup les invariants, la conservation des troupes et la relecture identique. | moyen |

## Déjà corrigé pendant la revue

- **Combats.** La bataille où les deux camps tombent ensemble est une victoire (plus de bande vide sur la carte). Le dragon ne se bat plus seul : il ne fait plus disparaître l'armée et son butin. Le butin respecte la charge. On ne peut plus remettre ses blessés sur pied en réattaquant aussitôt.
- **Parties abîmées.** Une partie abîmée n'est plus reprise : on évite une page blanche ou un jeu qui tourne sans fin, et elle est mise de côté. Deux onglets ne s'écrasent plus l'un l'autre. Un stockage plein est signalé. En ligne, un ordre donné pendant une coupure est refusé, au lieu d'être effacé sans un mot.
- **Serveur.** Le verrou des mots de passe ne se contourne plus en envoyant les essais en même temps. Des noms inventés ne remplissent plus la mémoire. Un nom pris est refusé sans calcul coûteux. Seul le JSON est accepté.
- **Interface.**
  - Un objectif mène au Puits de mana avant le Château 3, et le jeu dit ce qui manque.
  - Les messages se posent en bas de la carte, sans plus cacher l'objectif.
  - L'œuf de dragon est annoncé, et le siège est cadré.
  - « Réduire les animations » garde les dégâts à l'écran, les 💤 du dragon se voient, et les pulsations sont allégées.
  - Quelques textes sont corrigés.
