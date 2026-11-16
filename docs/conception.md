# Document de conception

Ce document rassemble les choix de game design du jeu. C'est la référence : on le met à jour à chaque nouvelle décision.

Chaque point porte un statut :
- **[Décidé]** : validé (ça peut encore évoluer).
- **[Proposition]** : idée à valider ou à modifier.
- **[À trancher]** : question encore ouverte.

## 1. Le concept

Un jeu de stratégie et de gestion de royaume, médiéval-fantastique et multijoueur. Chaque joueur développe sa cité, récolte des ressources, entraîne des armées et maîtrise la magie, puis s'allie ou s'affronte avec les autres joueurs sur une carte commune.

Boucle de jeu : récolter des ressources → construire et améliorer → entraîner des troupes → explorer et combattre → gagner des récompenses → construire plus grand.

- **[Décidé]** Même genre que Rise of Kingdoms, mais univers, noms, personnages et graphismes 100 % originaux.
- **[Décidé]** Gratuit pour tous : personne ne paie pour avancer plus vite ou devenir plus fort.
- **[Décidé]** Web d'abord, puis appli Android via Ionic.
- **[À trancher]** Le nom du jeu.

## 2. Le temps

- **[Décidé]** Tout se passe en temps réel, avec des durées, comme dans Rise of Kingdoms : construire, améliorer, rechercher, entraîner des troupes ou envoyer une armée prend du temps. Les premières actions durent quelques secondes, puis les durées s'allongent avec les niveaux.
- **[Décidé]** Le royaume continue de produire, et les chantiers d'avancer, même quand le joueur est déconnecté.
- **[Décidé]** Pas de tour par tour : les combats aussi se déroulent en temps réel. Une bataille prend du temps : elle se joue sur la carte, manche après manche, et on la voit avancer. À la fin, elle produit un rapport de bataille.

## 3. Les ressources

- **[Décidé]** Cinq ressources : nourriture, bois, pierre, or et mana.
- **[Décidé]** Leurs usages et les bâtiments qui les produisent :

| Ressource  | Sert surtout à                          | Produite par  |
|------------|-----------------------------------------|---------------|
| Nourriture | entraîner et entretenir les troupes     | Ferme         |
| Bois       | construire, fabriquer armes et machines | Scierie       |
| Pierre     | bâtiments avancés, remparts             | Carrière      |
| Or         | recherches, recrutement des héros       | Mine d'or     |
| Mana       | sorts, unités magiques                  | Puits de mana |

- **[Décidé]** On récolte aussi des ressources hors de la cité, sur les gisements de la carte des alentours (voir « Le monde »).

## 4. Les races

- **[Décidé]** Plusieurs races jouables, chacune avec ses avantages.
- **[Décidé]** Quatre races pour commencer. D'autres pourront s'ajouter, et on pourra leur donner des noms propres à notre univers.

| Race    | Style                 | Bonus (chiffres à équilibrer)                   |
|---------|-----------------------|-------------------------------------------------|
| Humains | polyvalents           | constructions 10 % plus rapides                 |
| Elfes   | magie et archerie     | +10 % de bois et de mana                        |
| Nains   | défense et artisanat  | +10 % de pierre et d'or                         |
| Orcs    | force brute et nombre | +10 % de nourriture, entraînement plus rapide   |

Plus tard, chaque race aura aussi une unité qui lui est propre.

## 5. La cité

- **[Décidé]** Le **Château** est le bâtiment central : son niveau limite celui des autres bâtiments, et l'améliorer débloque de nouveaux bâtiments.
- **[Décidé]** Bâtiments de production : Ferme, Scierie, Carrière, Mine d'or, Puits de mana.
- **[Décidé]** Un seul chantier à la fois au début, un second plus tard.
- **[Proposition]** Le second chantier s'ouvre au Château niveau 5. Deux bâtiments différents peuvent alors s'améliorer en même temps, jamais le même deux fois.
- **[Décidé]** Bâtiments suivants : Caserne (troupes), Académie (recherches), Tour des mages (sorts), Remparts (défense).
- **[Proposition]** La **Tour des mages** se débloque au Château niveau 4. Elle lance des sorts : contre du mana, un bienfait de quelques minutes pour toute la cité ou toutes les armées. Un même sort ne se lance pas deux fois à la fois, et chaque niveau de la Tour en débloque un : Moisson abondante (+25 % de nourriture, 10 min), Sève vive (+25 % de bois et de pierre, 10 min), Fureur guerrière (+15 % d'attaque, 5 min), Vent porteur (−20 % de temps de marche, 5 min) et Peau de pierre (+15 % de vie dans les batailles qui commencent, 5 min).
- **[Décidé]** L'**Académie** (débloquée au Château niveau 3) mène les recherches : une à la fois, et aucune recherche ne dépasse le niveau de l'Académie.
- **[Proposition]** Huit recherches pour commencer : Agriculture (nourriture), Outils de qualité (bois et pierre), Alchimie (or et mana), Forge (attaque des troupes), Armures (vie des troupes), Maçonnerie (constructions plus rapides), Marche forcée (marche plus rapide) et Commandement (une armée de plus sur la carte par niveau).

## 6. Armées et héros

- **[Décidé]** Quatre familles de troupes : Guerriers, Archers, Cavaliers et Mages, avec des forces et des faiblesses entre elles.
- **[Proposition]** Les forces et faiblesses forment un cycle : Guerriers > Cavaliers > Archers > Mages > Guerriers. Une troupe inflige 50 % de dégâts en plus à la famille qu'elle domine.
- **[Décidé]** On peut entraîner plusieurs troupes en même temps.
- **[Proposition]** À la Caserne, chaque type de troupe s'entraîne de son côté : un entraînement à la fois par type, donc jusqu'à quatre en parallèle. Le niveau de la Caserne débloque les Cavaliers (niveau 2) et les Mages (niveau 3), augmente le nombre de troupes par entraînement et accélère l'entraînement.
- **[Proposition]** Les batailles se jouent en manches, sans hasard : les mêmes armées donnent toujours le même résultat. Une manche toutes les 2 secondes ; après 100 manches sans vainqueur, les deux camps se séparent.
- **[Proposition]** Pendant une bataille, on peut battre en retraite : l'armée quitte le combat avec ses survivants, sans butin, et cette bande ne l'attaquera plus.
- **[Décidé]** Chaque rapport de bataille contient le journal du combat : qui avait l'avantage, puis chaque manche (dégâts infligés de chaque côté, pertes, troupes restantes), puis l'issue.
- **[Décidé]** Les troupes mangent : chaque troupe consomme de la nourriture chaque heure, dans la cité comme sur la carte. Une grosse armée coûte donc cher à garder.
- **[Décidé]** Si les réserves de nourriture sont vides et que les fermes ne suffisent plus, c'est la famine. Personne ne déserte, mais les troupes ont faim et se battent moins bien.
- **[Proposition]** Des troupes affamées perdent 30 % de leur attaque au combat. Pour sortir de la famine, on améliore sa Ferme ou on renvoie des troupes : les troupes renvoyées ne mangent plus, mais elles quittent l'armée.
- **[Décidé]** Des **héros** mènent les armées ; ils gagnent de l'expérience et débloquent des compétences.
- **[Proposition]** Cinq héros pour commencer, recrutés avec de l'or (et un peu de mana pour deux d'entre eux), chacun à partir d'un niveau du Château : Ysolde de Valcourt (capitaine de la garde, pour les guerriers, Château 2), Durgan Barbe-de-Granite (maître des mines, pour la récolte, Château 2), Faëlan Flèche-d'Argent (maître archer, Château 3), Garrok aux Deux Haches (chef de guerre, pour les cavaliers, Château 4) et Thalia des Brumes (archimage, pour les mages, Château 5).
- **[Proposition]** Un héros mène une seule armée à la fois. On le choisit au moment d'envoyer l'armée, ou on n'en prend aucun. Il ne meurt jamais : si son armée tombe, il revient à la cité.
- **[Proposition]** Un héros gagne de l'expérience pour chaque monstre vaincu (de 4 pour un gobelin à 30 pour un troll), quelle que soit l'issue de la bataille. Il faut 100 points d'expérience pour passer au niveau 2, puis 1,5 fois plus à chaque niveau, jusqu'au niveau 10.
- **[Proposition]** Chaque niveau donne un point de compétence. Chaque héros a trois compétences de 5 niveaux : avec 10 points pour 15 niveaux, il faut choisir. Les effets, pour l'armée qu'il mène : attaque ou vie de toute l'armée (+3 % par niveau), attaque d'une famille de troupes (+6 %), temps de marche (−6 %), vitesse de récolte ou charge (+10 %).
- **[Décidé]** Des **créatures légendaires** (dragons…) : rares, très puissantes, obtenues par des quêtes.

## 7. Le monde

- **[Décidé]** Une carte commune à tous les joueurs d'un serveur : cités, gisements de ressources, monstres, lieux légendaires.
- **[Décidé]** Des **alliances** : entraide, attaques groupées, territoire commun.
- **[Proposition]** En attendant la carte commune (étape 4), une carte des « alentours » de la cité, avec quatre camps de monstres : Tanière de loups, Campement gobelin, Ruines hantées et Antre du troll. Un camp est toujours là : on peut l'attaquer autant de fois qu'on veut, et chaque victoire rapporte son butin.
- **[Décidé]** Comme dans Rise of Kingdoms, une armée qui sort de la cité reste sur la carte, et on la dirige : aller à un endroit, attaquer un camp ou une bande, récolter un gisement, ou rentrer à la cité. On peut lui donner un nouvel ordre à tout moment, même en pleine marche.
- **[Proposition]** Après une victoire, l'armée attend sur place avec son butin, qui rejoint les réserves quand elle rentre à la cité. Une armée vaincue est perdue, avec ce qu'elle portait.
- **[Décidé]** Plusieurs armées peuvent être dehors en même temps, de plus en plus au fil des recherches.
- **[Proposition]** Une armée au départ, plus une par niveau de Commandement (trois au maximum pour l'instant).
- **[Proposition]** Les armées marchent en ligne droite, toujours à la même vitesse (la Marche forcée l'augmente) : plus le chemin est long, plus la marche dure.
- **[Décidé]** Des **gisements de ressources** sur la carte : champs (nourriture), scieries (bois), carrières (pierre), mines d'or et sources de mana. On y envoie une armée récolter, et elle rapporte sa récolte à la cité.
- **[Proposition]** Chaque troupe récolte un peu chaque seconde : par minute, 18 de nourriture ou de bois, 15 de pierre, 6 d'or ou 3,6 de mana. Chaque troupe porte aussi une charge limitée (guerrier 20, archer 15, cavalier 30, mage 10), pour la récolte comme pour le butin. L'armée rentre d'elle-même quand elle est pleine, ou quand le gisement est vide. Une seule armée à la fois par gisement.
- **[Proposition]** Six gisements au début, puis un nouveau chaque minute, dix au plus sur la carte. Plus un gisement est loin de la cité, plus son niveau est élevé, et plus il contient de ressources (60 % de plus par niveau). Un gisement vidé disparaît, et un autre apparaîtra plus tard.
- **[Décidé]** Des **bandes de monstres** apparaissent sur la carte des alentours, avec des niveaux différents et une **zone d'aggro**. Elles **patrouillent** : chaque bande fait des rondes autour de son repaire, et sa zone d'aggro la suit.
- **[Proposition]** Les bandes arrivent peu à peu : quatre au début de la partie, puis une nouvelle toutes les 90 secondes, huit au plus sur la carte. Plus une bande est loin de la cité, plus son niveau est élevé (de 1 à 5), et une sur quatre a un niveau de plus. Quatre sortes : meutes de loups, pillards gobelins, patrouilles de squelettes (dès le niveau 2) et bandes de trolls (dès le niveau 4).
- **[Proposition]** Une ronde est une boucle autour du repaire, parcourue lentement (à 40 % de la vitesse d'une armée), dans un sens ou dans l'autre. Une bande s'arrête le temps d'un combat, puis reprend sa ronde.
- **[Proposition]** La zone d'aggro est un cercle autour de la bande, plus grand quand son niveau monte. Une bande attaque toute armée qui entre dans sa zone, mais jamais deux fois la même. Attaquée en chemin, une armée qui survit à la bataille reprend sa route (sa récolte, son retour…) ; vaincue, elle est perdue. Avant chaque ordre, les fiches préviennent des bandes qui patrouillent près du chemin.
- **[Proposition]** On peut aussi attaquer une bande directement : l'armée la poursuit, et la bataille commence dès qu'elle entre dans sa zone d'aggro. Vaincue, la bande disparaît, et une autre viendra plus tard ; sinon, elle garde ses pertes et reprend sa ronde.

## 8. Les cartes

- **[Décidé]** Le jeu se voit sur des cartes : la cité (chaque bâtiment sur son emplacement, dans l'enceinte) et ses alentours (les camps de monstres, les bandes et leurs rondes, les gisements, tes armées et leurs batailles). On s'y promène en faisant glisser la carte, et on zoome avec deux doigts, la molette ou les boutons.
- **[Proposition]** Toucher un bâtiment, un camp, une bande ou un gisement affiche sa fiche sous la carte ; une liste de pastilles permet aussi de les choisir sans chercher sur la carte, et la carte des alentours se centre sur ce qu'on choisit. Les emojis seront remplacés par les images du guide graphique.
- **[Proposition]** Pour diriger une armée, on la touche (sur la carte, ou sa pastille), puis on touche un endroit de la carte, une cible (camp, bande, gisement) ou la cité. Sa fiche montre alors le nouvel ordre, avec la durée de la marche et les bandes qui patrouillent près du chemin ; « Valider l'ordre » l'envoie. La fiche de l'armée propose aussi « Rentrer à la cité », ou « Battre en retraite » pendant une bataille.
- **[Proposition]** Sur la carte des alentours, chaque zone d'aggro est un cercle rouge autour de sa bande, et chaque ronde est tracée en pointillés. La route vers la cible choisie, ou vers le prochain ordre de l'armée choisie, est tracée en pointillés dorés, et les bandes qui patrouillent près de cette route ressortent davantage. Une bataille en cours se voit sur la carte, avec le numéro de sa manche.

## 9. Les quêtes

- **[Proposition]** Une suite d'objectifs guide le joueur, du premier chantier aux grandes batailles : un objectif à la fois, dans l'ordre, comme une histoire. Chaque objectif atteint donne une récompense en ressources, à recevoir d'un geste. L'objectif du moment s'affiche en haut de l'onglet Cité, et un point doré sur l'onglet signale une récompense à recevoir.
- **[Proposition]** Quinze objectifs pour commencer : construire la Mine d'or, monter le Château au niveau 2, la Ferme au niveau 2, construire la Caserne, rassembler 20 guerriers, recruter un héros, remporter une bataille, récolter 500 ressources sur les gisements, Château niveau 3, construire l'Académie, terminer une recherche, vaincre 3 bandes de monstres, monter un héros au niveau 3, Château niveau 5, et remporter 10 batailles.
- **[À trancher]** La suite : des quêtes qui racontent l'histoire du royaume (avec des personnages), des quêtes quotidiennes, et les créatures légendaires, à gagner par des quêtes.

## 10. Les comptes et le serveur

- **[Décidé]** Le serveur garde les parties et applique lui-même les règles du jeu. Le navigateur n'envoie que des ordres (« améliorer la Ferme », « entraîner 20 archers »…) : impossible de tricher en modifiant le jeu dans son navigateur.
- **[Proposition]** Un compte, c'est un nom de joueur (unique, et visible des autres joueurs) et un mot de passe. Pas d'adresse e-mail pour l'instant : le serveur ne garde rien de personnel, mais un mot de passe oublié ne peut pas être récupéré.
- **[Proposition]** On peut toujours jouer sans compte : la partie reste sur l'appareil. Elle ne peut pas passer en ligne ensuite, sinon on pourrait la modifier avant de l'envoyer.
- **[Décidé]** Pour l'instant, le jeu se développe avec un serveur local, sur l'ordinateur. La mise en ligne chez un hébergeur (payant) viendra plus tard.
- **[À trancher]** Quel hébergeur, le moment venu.

## 11. Feuille de route

Chaque étape donne un jeu jouable.

1. **Prototype solo dans le navigateur** : la cité, les ressources, les bâtiments et leurs durées de construction. *En place* : choix de la race, cinq ressources, huit bâtiments, un chantier à la fois puis deux au Château niveau 5, production hors connexion.
2. **Armées** : troupes, recherches, combats contre des monstres. *En place* : Caserne, quatre troupes, Académie et recherches, cartes de la cité et des alentours, plusieurs armées qu'on dirige sur la carte, camps de monstres, bandes de monstres qui patrouillent (avec leurs niveaux et leurs zones d'aggro), batailles qui durent et leurs rapports, gisements de ressources à récolter, et des héros qui mènent les armées.
3. **Serveur et comptes joueurs** : sauvegarde en ligne ; le serveur décide de tout. *En cours* : comptes (nom et mot de passe), parties gardées sur le serveur, qui applique les règles, et partie sans compte toujours possible. Reste à mettre le jeu en ligne chez un hébergeur, plus tard.
4. **Monde partagé** : la carte, les attaques entre joueurs, les alliances.
5. **Contenu et mobile** : quêtes, livre de sorts, créatures légendaires, puis l'appli Android. *Commencé* : une première suite de quinze objectifs, avec leurs récompenses, et les cinq premiers sorts de la Tour des mages.

Les chiffres du jeu (coûts, durées, production, bonus des races) sont regroupés dans `src/game/config.ts`, pour pouvoir équilibrer le jeu sans toucher au reste du code.
