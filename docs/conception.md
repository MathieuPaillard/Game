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
- **[Décidé]** La progression se compte en mois, voire en années : la puissance n'a pas de limite. Faire le tour des recherches (la limite technologique) demande plusieurs mois de jeu. Les chantiers et les améliorations durent donc bien plus longtemps qu'aujourd'hui : chaque choix de ressources doit compter.

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
- **[Décidé]** Les réserves ont une limite, qui dépend de bâtiments et de recherches : pour stocker davantage, il faut agrandir ses entrepôts.

## 4. Les races

- **[Décidé]** Plusieurs races jouables, chacune avec ses avantages.
- **[Décidé]** Quatre races pour commencer. D'autres pourront s'ajouter, et on pourra leur donner des noms propres à notre univers.

| Race    | Style                 | Bonus (chiffres à équilibrer)                   | Troupe propre                     |
|---------|-----------------------|-------------------------------------------------|-----------------------------------|
| Humains | polyvalents           | constructions 10 % plus rapides                 | Paladins (famille des Guerriers)  |
| Elfes   | magie et archerie     | +10 % de bois et de mana                        | Druides (famille des Mages)       |
| Nains   | défense et artisanat  | +10 % de pierre et d'or                         | Arbalétriers nains (des Archers)  |
| Orcs    | force brute et nombre | +10 % de nourriture, entraînement plus rapide   | Chevaucheurs de loups (Cavaliers) |

- **[Décidé]** Chaque race a aussi une troupe qui lui est propre.
- **[Proposition]** Chaque troupe propre appartient à l'une des quatre familles (une famille différente pour chaque race) : elle en a les forces et les faiblesses, et profite des compétences de héros qui renforcent cette famille. Elle est plus forte que la troupe de base de sa famille, mais plus chère, et s'entraîne à partir de la Caserne niveau 4. Les autres races ne peuvent pas l'entraîner.
- **[Décidé]** Chaque race a aussi ses **soigneurs**, qui soignent leur armée pendant les batailles : druides pour les elfes, chamans pour les orcs, prêtres pour les humains (et un soigneur à nommer pour les nains).
- **[À trancher]** Les Druides sont aujourd'hui la troupe de combat propre aux elfes : deviennent-ils leurs soigneurs (et les elfes reçoivent une autre troupe de combat), ou les elfes ont-ils deux sortes de druides ? Quel soigneur pour les nains ?

## 5. La cité

- **[Décidé]** Le **Château** est le bâtiment central : son niveau limite celui des autres bâtiments, et l'améliorer débloque de nouveaux bâtiments.
- **[Décidé]** Bâtiments de production : Ferme, Scierie, Carrière, Mine d'or, Puits de mana.
- **[Décidé]** Un seul chantier à la fois au début, un second plus tard.
- **[Proposition]** Le second chantier s'ouvre au Château niveau 5. Deux bâtiments différents peuvent alors s'améliorer en même temps, jamais le même deux fois.
- **[Décidé]** Bâtiments suivants : Caserne (troupes), Académie (recherches), Tour des mages (sorts), Remparts (défense).
- **[Proposition]** L'**Aire du dragon** se débloque au Château niveau 6 : on y couve l'œuf de dragon, et le dragon y vit. Son niveau limite celui du dragon.
- **[Proposition]** Les **Remparts** se débloquent au Château niveau 3. Chaque niveau ajoute 8 gardes, qui défendent la cité à chaque siège, et donne +5 % de vie aux troupes qui la défendent (voir « Les raids et la défense de la cité »).
- **[Proposition]** La **Tour des mages** se débloque au Château niveau 4. Elle lance des sorts : contre du mana, un bienfait pour toute la cité ou toutes les armées. Un même sort ne se lance pas deux fois à la fois, et chaque niveau de la Tour en débloque un : Moisson abondante (+25 % de nourriture, 40 min, 180 mana), Sève vive (+25 % de bois et de pierre, 40 min, 300 mana), Fureur guerrière (+15 % d'attaque, 30 min, 600 mana), Vent porteur (−20 % de temps de marche, 30 min, 600 mana) et Peau de pierre (+15 % de vie dans les batailles qui commencent, 30 min, 800 mana).
- **[Décidé]** Les sorts durent plusieurs dizaines de minutes. Des sorts de défense peuvent protéger la cité pendant que le joueur est absent.
- **[Proposition]** Deux sorts de défense, pour les absences : on les lance avant de partir, et ils veillent toute une nuit (8 heures). L'**Égide des remparts** (Tour niveau 6, 1 500 mana) donne 30 % de vie en plus aux défenseurs de la cité (troupes, gardes, dragon) pendant les sièges. La **Brume d'oubli** (Tour niveau 7, 2 500 mana et 500 or) cache la cité : aucun raid ne part tant qu'elle agit, et le raid retenu part quand elle se lève (ceux déjà en marche arrivent quand même). Une fois dissipée, la Brume met 16 heures à se reformer : elle couvre une nuit par jour, pas toutes les heures (sans cela, un joueur assidu la relancerait sans cesse et ne verrait plus un seul raid). La fiche des Remparts dit quand ils veillent, et le résumé « Bon retour » aussi.
- **[Décidé]** Un **hôpital** soigne les blessés.
- **[Décidé]** L'**Académie** (débloquée au Château niveau 3) mène les recherches : une à la fois, et aucune recherche ne dépasse le niveau de l'Académie.
- **[Proposition]** Huit recherches pour commencer : Agriculture (nourriture), Outils de qualité (bois et pierre), Alchimie (or et mana), Forge (attaque des troupes), Armures (vie des troupes), Maçonnerie (constructions plus rapides), Marche forcée (marche plus rapide) et Commandement (une armée de plus sur la carte par niveau).

## 6. Armées et héros

- **[Décidé]** Quatre familles de troupes : Guerriers, Archers, Cavaliers et Mages, avec des forces et des faiblesses entre elles.
- **[Proposition]** Les forces et faiblesses forment un cycle : Guerriers > Cavaliers > Archers > Mages > Guerriers. Une troupe inflige 50 % de dégâts en plus à la famille qu'elle domine.
- **[Décidé]** On peut entraîner plusieurs troupes en même temps.
- **[Proposition]** À la Caserne, chaque type de troupe s'entraîne de son côté : un entraînement à la fois par type, donc jusqu'à quatre en parallèle. Le niveau de la Caserne débloque les Cavaliers (niveau 2) et les Mages (niveau 3), augmente le nombre de troupes par entraînement et accélère l'entraînement.
- **[Proposition]** Les batailles se jouent en manches, sans hasard : les mêmes armées donnent toujours le même résultat. Une manche toutes les 2 secondes ; après 150 manches sans vainqueur, les deux camps se séparent.
- **[Décidé]** Une bataille dure au moins une dizaine de manches : on a le temps de la regarder, et de battre en retraite.
- **[Proposition]** Pour cela, à chaque manche, une troupe n'inflige que 15 % de son attaque, et chaque assaillant ne peut ôter à sa cible plus d'un dixième de sa vie du début. Face à un seul adversaire, une bataille dure donc au moins 10 manches (20 secondes), même quand une armée en écrase une autre ; une bataille serrée dure plus longtemps. Les deux camps sont ralentis de la même façon : c'est toujours le plus fort qui gagne. Face à plusieurs adversaires, chacun ôte son dixième : on tombe bien plus vite.
- **[Décidé]** Une bataille est une **mêlée** : toutes les patrouilles peuvent attaquer une armée en même temps, et plusieurs armées la même bande, le même camp ou le même raid. La seule limite est l'encombrement : **8 assaillants au plus** autour d'une troupe. Selon qu'un assaillant frappe **de face, de côté ou de dos**, son bonus d'attaque change. Une troupe **encerclée** subit un malus.
- **[Proposition]** Chaque troupe (une armée, une bande, un camp, un raid) frappe une seule cible, et regarde vers elle. Autour d'une cible, il y a huit places, une par direction : un assaillant prend la place libre la plus proche du côté d'où il arrive ; quand les huit sont prises, il attend son tour. De côté, il frappe 15 % plus fort ; de dos, 30 %. Une troupe frappée d'au moins trois côtés (devant, à gauche, à droite, derrière) est encerclée : elle perd 25 % de son attaque. La cité, derrière ses murs, n'a ni flancs ni dos, et n'est jamais encerclée.
- **[Proposition]** Une bande qui voit une armée déjà au combat accourt et rejoint la mêlée ; une armée envoyée contre une bande ou un camp qui se bat déjà s'y joint aussi. Un raid qui arrive pendant un siège s'y joint ; quand la cité est entourée, il attend aux portes. Une armée revenue aider la cité frappe les raids de l'extérieur, souvent dans le dos.
- **[Proposition]** Quand sa cible tombe, une troupe se tourne vers un de ceux qui la frappent, sinon vers l'adversaire le plus proche qui a encore une place libre. Pendant une mêlée, toucher un autre adversaire de la mêlée y tourne ton armée, sans quitter le combat.
- **[Proposition]** Le butin d'un adversaire tombé se partage entre les armées qui l'ont frappé, selon leurs coups ; chacune n'emporte que ce que portent ses survivants. Le gardien de la clef la laisse à l'armée qui l'a frappé le plus fort. L'expérience d'un héros vient des monstres que son armée a abattus.
- **[Proposition]** Pendant une bataille, on peut battre en retraite : l'armée quitte la mêlée avec ses survivants, et les bandes de cette mêlée ne l'attaqueront plus. Elle garde sa part du butin des adversaires déjà tombés. Elle ne peut pas reprendre aussitôt le même combat (ses blessés seraient remis sur pied).
- **[Proposition]** Quand tous les monstres d'une mêlée tombent, c'est une victoire pour toutes tes troupes, même si les derniers soldats tombent dans la même manche ; mais sans survivant, personne ne rapporte le butin.
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
- **[Proposition]** La première créature légendaire est un **dragon**. Son œuf se gagne avec l'objectif « La légende du dragon » : vaincre le Nid de la vouivre, où les vouivres le gardent. On le couve dans l'Aire du dragon (800 de nourriture et 600 de mana) : 15 minutes plus tard, le dragon éclôt.
- **[Proposition]** Le dragon gagne de l'expérience au combat, comme un héros (300 pour passer au niveau 2, puis 1,6 fois plus à chaque niveau), mais ne dépasse jamais le niveau de son aire, ni le niveau 10. Il crache le feu : il se bat comme un mage (les archers le dominent), avec 400 d'attaque et 3 000 de vie au niveau 1, et 30 % de plus à chaque niveau. Les bonus d'attaque et de vie de son camp comptent pour lui aussi. Il mange 25 de nourriture par heure et par niveau.
- **[Proposition]** Le dragon peut accompagner une armée, une seule à la fois et jamais seul : il lui faut une escorte. Resté dans son aire, il défend la cité pendant les sièges. Il ne meurt jamais : blessé, il quitte le combat, regagne son aire et s'y repose 20 minutes. Il ne se bat jamais seul : quand toute son escorte tombe, la bataille est perdue, et il regagne son aire pour s'y reposer de même. À la cité, il défend jusqu'au bout.
- **[Décidé]** Le dragon fait partie de l'armée, et peut lancer un **cône de flammes** qui frappe plusieurs adversaires à la fois. Selon sa **nature**, d'autres effets donnent des bonus ou des malus.
- **[À trancher]** D'autres créatures légendaires : une par race, ou d'autres quêtes pour d'autres créatures ?
- **[Décidé]** Le jeu ne prédit pas l'issue d'un combat. À la place, on envoie des **éclaireurs** sonder les troupes adverses et les cités ennemies.

## 7. Le monde

- **[Décidé]** Une carte commune à tous les joueurs d'un serveur : cités, gisements de ressources, monstres, lieux légendaires.
- **[Décidé]** Des **alliances** : entraide, attaques groupées, territoire commun.
- **[Proposition]** En attendant la carte commune (étape 4), une carte des « alentours » de la cité, avec cinq camps de monstres, du niveau 1 au niveau 5 : Tanière de loups, Campement gobelin, Ruines hantées, Antre du troll et, de l'autre côté de la rivière, le Nid de la vouivre. Chaque victoire rapporte son butin.
- **[Décidé]** Un camp vaincu se repeuple au bout d'un moment : toutes les 2 heures pendant les essais, toutes les 8 heures une fois le jeu en ligne. En attendant, il est vide, et la carte dit quand ses monstres reviennent.
- **[Proposition]** Un camp vide se voit sur la carte : des tentes pâlies, sans feu de camp, et sous son nom le temps avant le retour de ses monstres. On ne peut pas l'attaquer ; une armée qui l'atteint alors qu'une autre vient de le vider attend sur place.
- **[Décidé]** De **grands campements**, à l'échelle d'une partie de la carte : leurs patrouilles barrent le chemin, et on ne peut pas les esquiver pour aller plus loin. C'est une épreuve qu'on ne réussit pas seul : elle est faite pour les alliances. Ils se repeuplent comme les camps.
- **[Proposition]** Le premier grand campement suit le plan du propriétaire (27 novembre 2026) : une enceinte avec une seule entrée, au sud, par un couloir gardé ; à l'intérieur, des patrouilles partout ; une clef à l'ouest ; une porte à l'est, qui s'ouvre avec la clef ; et le chef du campement au centre.
- **[Décidé]** Dans ce plan, les triangles sont des **montagnes infranchissables** : les armées les contournent et passent par les cols. La porte mène à une **région nouvelle**, au-delà du campement. Les croix sont à la fois des chefs d'élite (qui gardent la clef et le chef du campement), des pièges (qui blessent les armées qui passent) et une tour de guet (qui repère les armées et alerte les patrouilles). Les patrouilles ne barrent pas le passage : elles **poursuivent** les troupes pour les attaquer.
- **[Proposition]** La carte des alentours s'agrandit vers l'est : une barrière de montagnes la coupe du nord au sud, avec en son cœur le cirque du « campement des Crocs ». On y entre par un col, au sud-ouest ; une porte cadenassée, à l'est, mène à la région d'au-delà. Bandes et gisements n'apparaissent que là où une armée partie de la cité peut aller. Une montagne empêche aussi une bande d'attaquer une armée qui se tient derrière.
- **[Proposition]** Dans le cirque : cinq patrouilles des Crocs (niveau 6), qui font leur ronde ; le gardien de la clef, à l'ouest ; la tour de guet, au nord-ouest ; et au centre le Seigneur des Crocs (niveau 7), flanqué de deux gardes d'élite. Les chefs et la tour ne bougent pas, mais attaquent toute armée qui les approche. Ensemble, ils sont bien trop forts pour une seule armée (le mode d'essai permet de tester seul).
- **[Proposition]** L'armée qui bat le gardien emporte la clef ; arrivée au seuil de la porte, elle l'ouvre, jusqu'au repeuplement suivant. Si elle tombe, ou rentre à la cité, la clef retourne à son gardien, qui revient la garder. Une armée restée au-delà quand la porte se referme peut toujours revenir.
- **[Proposition]** Les patrouilles poursuivent les armées, partout sur la carte : une bande en patrouille voit 1,6 fois plus loin que sa zone d'aggro. Quand elle aperçoit une armée, elle quitte sa ronde et la prend en chasse, un peu plus vite qu'une armée ne marche (11 contre 10 par seconde), et l'attaque en la rattrapant. Elle renonce quand elle s'éloigne de plus de 220 de son repaire : l'armée l'a semée, et cette bande ne la poursuivra plus (mais l'attaque encore si elle passe à sa portée). Puis la bande regagne sa ronde, là où elle l'avait quittée. Les chefs du grand campement gardent leur place, et les raids leur route vers la cité.
- **[Proposition]** La tour de guet voit loin (260) : tant qu'elle tient, toute armée qu'elle aperçoit met les patrouilles du campement en alerte, et elles accourent toutes, même vers une armée déjà en plein combat (elles attendent alors leur tour). L'abattre d'abord rend le campement moins dangereux ; elle revient au repeuplement.
- **[Proposition]** Trois pièges cachés : à la sortie du col (presque tous les chemins y passent), sur le chemin du gardien et de la tour, et devant la porte. La première armée qui passe dessus le déclenche : 2 000 points de dégâts, répartis entre ses troupes selon leur nombre (les Armures, le héros et les sorts les protègent ; le dragon s'envole à temps). Le piège reste ensuite visible, désarmé, jusqu'au repeuplement, et un rapport raconte ce qu'il a coûté. Une armée anéantie par un piège est perdue, comme dans une bataille.
- **[Décidé]** Un **brouillard de guerre** cache ce qu'on n'a pas encore exploré, ou qu'on ne voit plus.
- **[Décidé]** Comme dans Rise of Kingdoms, une armée qui sort de la cité reste sur la carte, et on la dirige : aller à un endroit, attaquer un camp ou une bande, récolter un gisement, ou rentrer à la cité. On peut lui donner un nouvel ordre à tout moment, même en pleine marche.
- **[Proposition]** Après une victoire, l'armée attend sur place avec son butin, qui rejoint les réserves quand elle rentre à la cité. Une armée vaincue est perdue, avec ce qu'elle portait.
- **[Décidé]** Plusieurs armées peuvent être dehors en même temps, de plus en plus au fil des recherches.
- **[Proposition]** Une armée au départ, plus une par niveau de Commandement (trois au maximum pour l'instant).
- **[Proposition]** Les armées marchent en ligne droite, toujours à la même vitesse (la Marche forcée l'augmente) : plus le chemin est long, plus la marche dure.
- **[Décidé]** Des **gisements de ressources** sur la carte : champs (nourriture), scieries (bois), carrières (pierre), mines d'or et sources de mana. On y envoie une armée récolter, et elle rapporte sa récolte à la cité.
- **[Proposition]** Chaque troupe récolte un peu chaque seconde : par minute, 18 de nourriture ou de bois, 15 de pierre, 6 d'or ou 3,6 de mana. Chaque troupe porte aussi une charge limitée (guerrier 20, archer 15, cavalier 30, mage 10), pour la récolte comme pour le butin : ce qu'elle ne peut pas porter reste sur place. L'armée rentre d'elle-même quand elle est pleine, ou quand le gisement est vide. Une seule armée à la fois par gisement.
- **[Proposition]** Six gisements au début, puis un nouveau chaque minute, dix au plus sur la carte. Plus un gisement est loin de la cité, plus son niveau est élevé, et plus il contient de ressources (60 % de plus par niveau). Un gisement vidé disparaît, et un autre apparaîtra plus tard.
- **[Décidé]** Des **bandes de monstres** apparaissent sur la carte des alentours, avec des niveaux différents et une **zone d'aggro**. Elles **patrouillent** : chaque bande fait des rondes autour de son repaire, et sa zone d'aggro la suit.
- **[Proposition]** Les bandes arrivent peu à peu : quatre au début de la partie, puis une nouvelle toutes les 90 secondes, huit au plus sur la carte. Plus une bande est loin de la cité, plus son niveau est élevé (de 1 à 5), et une sur quatre a un niveau de plus. Six sortes : meutes de loups, pillards gobelins, patrouilles de squelettes (dès le niveau 2), hardes de sangliers (dès le niveau 3), bandes de trolls (dès le niveau 4) et vols de vouivres (au niveau 5).
- **[Proposition]** Les monstres de la fin de partie : les sangliers géants, qui chargent comme des cavaliers, et les vouivres, des serpents ailés des vieilles légendes, dont le venin agit comme une magie.
- **[Proposition]** Une ronde est une boucle autour du repaire, parcourue lentement (à 40 % de la vitesse d'une armée), dans un sens ou dans l'autre. Une bande s'arrête le temps d'un combat, puis reprend sa ronde (ou la regagne, si elle avait poursuivi l'armée).
- **[Proposition]** La zone d'aggro est un cercle autour de la bande, plus grand quand son niveau monte. Une bande attaque toute armée qui entre dans sa zone, ou qu'elle rattrape après l'avoir poursuivie, mais jamais deux fois la même. Attaquée en chemin, une armée qui survit à la bataille reprend sa route (sa récolte, son retour…) ; vaincue, elle est perdue. Avant chaque ordre, les fiches préviennent des bandes qui patrouillent près du chemin.
- **[Proposition]** On peut aussi attaquer une bande directement : l'armée la poursuit, et la bataille commence dès qu'elle entre dans sa zone d'aggro. Vaincue, la bande disparaît, et une autre viendra plus tard ; sinon, elle garde ses pertes et reprend sa ronde.

## 8. Les raids et la défense de la cité

- **[Décidé]** Des **raids de monstres** viennent attaquer la cité : c'est contre eux que servent d'abord les Remparts.
- **[Proposition]** Les raids commencent quand le Château atteint le niveau 3 : le premier part 5 minutes plus tard, puis un nouveau toutes les 30 minutes. Un raid part d'un bord de la carte et marche droit sur la cité, lentement (60 % de la vitesse d'une armée) : on le voit venir, avec le compte à rebours de son arrivée.
- **[Proposition]** Un raid est une bande de monstres d'une sorte tirée au sort, avec une fois et demie plus de monstres qu'une bande du même niveau, et un butin plus gros d'autant. Son niveau suit le Château : niveau 1 au Château 3, puis un de plus par niveau du Château, jusqu'au niveau 5.
- **[Proposition]** On peut intercepter un raid en chemin avec une armée : vaincu, il compte comme repoussé, et l'armée garde son butin. En chemin, un raid attaque aussi les armées qu'il croise, puis reprend sa marche.
- **[Proposition]** Arrivé à la cité, le raid l'assiège : une bataille en manches, comme dehors, contre toutes les troupes présentes dans la cité et les gardes des Remparts. Les gardes tirent du haut des murs, comme des archers (12 d'attaque, 45 de vie) ; ceux qui tombent sont remplacés, et le siège suivant les retrouve au complet. Pendant un siège, les troupes ne peuvent ni sortir ni être renvoyées. Un raid qui arrive pendant un siège s'y joint (voir les mêlées) ; quand huit raids entourent déjà la cité, il attend son tour aux portes. Vainqueurs, les raids pillent ensemble.
- **[Proposition]** Repoussé, le raid laisse son butin dans les réserves. Victorieux, il pille la cité : 20 % de chaque ressource, sauf ce que le Château met à l'abri (300 de chaque ressource par niveau du Château), et chaque monstre encore debout n'emporte que 40 ressources. Après un pillage, les monstres laissent la cité tranquille au moins 2 heures. Dans tous les cas, le raid s'en va ensuite.
- **[Proposition]** On soigne les défenseurs dans la cité : la moitié des troupes tombées pendant un siège se relève après la bataille. Une cité sans troupes ni gardes est pillée sans combat.
- **[Décidé]** Plus tard, les **autres joueurs** pourront aussi attaquer la cité, et les Remparts la défendront de la même façon.
- **[Proposition]** Les attaques entre joueurs viendront avec le monde partagé (étape 4 de la feuille de route). Il faut d'abord une carte commune où les armées d'un joueur peuvent atteindre la cité d'un autre, et un serveur qui fait avancer toutes les parties ensemble : aujourd'hui, chaque partie avance seule, et le serveur ne la calcule que quand son joueur se connecte. Les règles du siège (défenseurs, gardes, pillage, part mise à l'abri) sont écrites pour servir aussi à ces attaques.
- **[À trancher]** Comment protéger les débutants des attaques des autres joueurs (un bouclier pendant les premiers jours ?), et ce que gagne un joueur qui en attaque un autre.

## 9. L'écran de jeu

- **[Décidé]** Le jeu s'affiche comme un jeu mobile, en mode paysage : la carte remplit l'écran (la cité, ou ses alentours), avec les ressources en haut et des boutons aux coins.
- **[Décidé]** On agit en touchant directement la carte : les bâtiments, les troupes (la garnison dans la cité, les armées dehors), les héros, les gisements, les camps, les bandes, la cité. Ce qu'on touche ouvre sa fiche à côté de la carte, avec tout ce qu'on peut en faire.
- **[Décidé]** Comme dans Rise of Kingdoms, on déplace une armée sans bouton à valider : on la touche, puis on touche sa destination (un endroit, une cible, ou la cité pour rentrer). On peut aussi la faire glisser du doigt jusqu'à sa destination.
- **[Proposition]** Une armée qui se bat ne bat en retraite que par son bouton « Battre en retraite » : un toucher malheureux ne doit pas la dégager.
- **[Proposition]** Pour faire sortir une nouvelle armée, on touche sa cible (camp, bande ou gisement) : la fiche propose toutes les troupes de la cité et un héros libre, à ajuster avec des réglettes, puis « Attaquer » ou « Récolter ». La même fiche permet d'y envoyer d'un geste une armée déjà dehors.
- **[Proposition]** Sur la carte de la cité : chaque bâtiment sur son emplacement, la garnison et les héros. Sur l'écran : l'objectif du moment (un toucher suffit pour recevoir sa récompense), ce qui est en cours (chantiers, recherche, entraînements, sorts, avec leur compte à rebours), les armées dehors, un grand bouton pour passer de la cité aux alentours, et les pages Héros, Rapports et Menu.
- **[Proposition]** Un raid se voit de loin. En haut de l'écran, une alerte donne le compte à rebours de son arrivée ; la toucher montre le raid sur la carte des alentours, où son chemin jusqu'à la cité est tracé en rouge, et sa fiche propose de l'intercepter. Pendant un siège, l'alerte devient « Cité assiégée » et ouvre la défense de la cité ; le mur s'entoure de rouge et les monstres se pressent devant la porte sud. Les rapports racontent les sièges du point de vue de la cité.
- **[Proposition]** Le mur de la cité montre les Remparts : une palissade tant qu'ils ne sont pas construits, puis un mur de pierre crénelé, plus épais à chaque niveau. La fiche des Remparts montre la défense de la cité : les gardes, la vie en plus, les troupes présentes, ce que le Château met à l'abri, et quand viendra le prochain raid.
- **[Proposition]** Sur la carte des alentours, le cercle rouge autour d'une bande en patrouille montre jusqu'où elle voit ; autour d'un chef ou d'un raid, sa zone d'aggro. Chaque ronde est tracée en pointillés. Une poursuite se voit : un trait rouge file de la bande vers l'armée, la bande porte un « ! », la puce de l'armée aussi, et sa fiche dit qui la poursuit. Au grand campement, les cercles se chevauchent tous : ils n'ont pas de bord, sauf pour la bande choisie et celles qui guettent la route ; on y voit aussi la zone que surveille la tour de guet, et les pièges déclenchés. La route de l'armée choisie, ou celle vers la cible choisie, est tracée en pointillés dorés, et les bandes qui patrouillent près de cette route ressortent davantage. Une bataille en cours se voit sur la carte, avec le numéro de sa manche.
- **[Proposition]** On se promène sur les cartes en les faisant glisser, et on zoome avec deux doigts, la molette ou les boutons. Chaque carte garde sa vue quand on passe à l'autre.
- **[Proposition]** Sur la carte de la cité, l'Aire du dragon montre l'œuf, qui remue, ou le dragon quand il est chez lui : il respire, ou dort quand il est blessé. Pour un combat, le dragon part par défaut avec la nouvelle armée s'il est dans son aire et en forme ; une étiquette permet de le laisser. Un badge 🐉 marque l'armée qu'il accompagne.
- **[Décidé]** Les batailles et les cartes sont animées.
- **[Proposition]** Une bataille se regarde : chaque camp a sa barre de vie (dorée pour tes troupes, rouge pour les monstres), les dégâts de chaque manche s'envolent au-dessus de ceux qui les reçoivent, qui tremblent sous les coups, des étincelles volent d'un camp à l'autre, et les épées croisées portent le numéro de la manche. Dans une mêlée, chacun se tient à sa place autour de sa cible, et une ligne relie chaque assaillant à sa cible ; une armée encerclée a un anneau rouge qui bat. Sa fiche dit qui elle frappe et de quel côté, qui la frappe et d'où, et si elle est encerclée ; les rapports nomment tous les adversaires de la mêlée.
- **[Proposition]** Les cartes vivent : la rivière coule, le lac miroite, des nuages passent, les feux de camp vacillent, les armées et les bandes avancent d'un pas balancé, les récolteurs piochent ; dans la cité, le marteau des chantiers frappe, les bâtiments laissent s'envoler ce qu'ils produisent, le puits de mana luit, et la Caserne, l'Académie et la Tour des mages montrent quand elles travaillent. Le sol a des touffes d'herbe, les montagnes sont enneigées, arbres et montagnes ont une ombre. Ceux qui demandent à leur appareil de réduire les animations ne voient rien bouger.
- **[Proposition]** Téléphone tenu en hauteur : le jeu marche aussi (la fiche s'ouvre sous la carte), et une étiquette conseille de tourner l'écran. Le menu propose le plein écran, qui bloque l'écran en paysage quand le navigateur le permet. L'appli Android, elle, sera toujours en paysage.
- **[Proposition]** Les emojis seront remplacés par les images du guide graphique.

## 10. Les quêtes

- **[Proposition]** Une suite d'objectifs guide le joueur, du premier chantier aux grandes batailles : un objectif à la fois, dans l'ordre, comme une histoire. Chaque objectif atteint donne une récompense en ressources, à recevoir d'un geste. Un bouton grisé dit pourquoi, et quand il manque des ressources, lesquelles et combien. L'objectif du moment s'affiche sur l'écran de jeu : quand il est atteint, un toucher suffit pour recevoir sa récompense.
- **[Proposition]** Vingt-six objectifs pour commencer, environ trois heures et demie de jeu : construire la Mine d'or, monter le Château au niveau 2, la Ferme au niveau 2, construire la Caserne, rassembler 20 guerriers, recruter un héros, remporter une bataille, récolter 500 ressources sur les gisements, construire le Puits de mana (le Château 3 demande du mana, et un joueur ne le devinait pas), Château niveau 3, construire les Remparts, construire l'Académie, terminer une recherche, vaincre 3 bandes de monstres, monter un héros au niveau 3, repousser un raid, Château niveau 5 et remporter 10 batailles. Puis vient la légende du dragon : Château niveau 6, une victoire contre l'Antre du troll, les Remparts au niveau 3, le Nid de la vouivre (qui garde un œuf de dragon), l'Aire du dragon, l'éclosion, 3 raids repoussés, et le dragon au niveau 3.
- **[Proposition]** Un objectif peut donner un présent en plus des ressources : « La légende du dragon » donne l'œuf de dragon.
- **[À trancher]** La suite : des quêtes qui racontent l'histoire du royaume (avec des personnages), des quêtes quotidiennes, et les créatures légendaires, à gagner par des quêtes.

## 11. Les comptes et le serveur

- **[Décidé]** Le serveur garde les parties et applique lui-même les règles du jeu. Le navigateur n'envoie que des ordres (« améliorer la Ferme », « entraîner 20 archers »…) : impossible de tricher en modifiant le jeu dans son navigateur.
- **[Proposition]** Un compte, c'est un nom de joueur (unique, et visible des autres joueurs) et un mot de passe. Pas d'adresse e-mail pour l'instant : le serveur ne garde rien de personnel, mais un mot de passe oublié ne peut pas être récupéré.
- **[Proposition]** On peut toujours jouer sans compte : la partie reste sur l'appareil. Elle ne peut pas passer en ligne ensuite, sinon on pourrait la modifier avant de l'envoyer.
- **[Décidé]** Pour l'instant, le jeu se développe avec un serveur local, sur l'ordinateur. La mise en ligne chez un hébergeur (payant) viendra plus tard.
- **[À trancher]** Quel hébergeur, le moment venu.

## 12. Feuille de route

Chaque étape donne un jeu jouable.

1. **Prototype solo dans le navigateur** : la cité, les ressources, les bâtiments et leurs durées de construction. *En place* : choix de la race, cinq ressources, huit bâtiments, un chantier à la fois puis deux au Château niveau 5, production hors connexion.
2. **Armées** : troupes, recherches, combats contre des monstres. *En place* : Caserne, quatre troupes, Académie et recherches, cartes de la cité et des alentours, plusieurs armées qu'on dirige sur la carte, camps de monstres, bandes de monstres qui patrouillent (avec leurs niveaux et leurs zones d'aggro), batailles qui durent et leurs rapports, gisements de ressources à récolter, des héros qui mènent les armées, et les Remparts contre les raids de monstres sur la cité.
3. **Serveur et comptes joueurs** : sauvegarde en ligne ; le serveur décide de tout. *En cours* : comptes (nom et mot de passe), parties gardées sur le serveur, qui applique les règles, et partie sans compte toujours possible. Reste à mettre le jeu en ligne chez un hébergeur, plus tard.
4. **Monde partagé** : la carte commune, les attaques entre joueurs (contre leurs Remparts), les alliances.
5. **Contenu et mobile** : quêtes, livre de sorts, créatures légendaires, puis l'appli Android. *Commencé* : une première suite de vingt-six objectifs, avec leurs récompenses, les cinq premiers sorts de la Tour des mages, et le dragon, première créature légendaire.

La suite, décidée le 27 novembre 2026, dans l'ordre :

1. Les camps qui se repeuplent, et un mode d'essai qui renforce les troupes. *Fait.*
2. Le premier grand campement, d'après le plan. *Fait* : montagnes et col, porte et clef, chefs, tour de guet, pièges, patrouilles qui poursuivent les armées.
3. Des sorts de plusieurs dizaines de minutes, et des sorts de défense pour les absences. *Fait.*
4. La limite des réserves : entrepôts et recherches.
5. L'hôpital et les soigneurs de chaque race.
6. Le dragon dans l'armée : le cône de flammes et les natures de dragon.
7. La progression sur plusieurs mois : des durées bien plus longues, des niveaux sans limite.
8. Les éclaireurs et le brouillard de guerre.

- **[Décidé]** Pour les essais, un **mode d'essai** renforce les troupes du joueur, pour tester seul ce qui demande normalement plusieurs joueurs. Il ne sert qu'aux parties sans compte : le serveur le refuse.
- **[Proposition]** Il s'active dans le Menu. Les troupes du joueur et son dragon frappent et encaissent alors 10 fois plus, y compris quand ils défendent la cité, et une étiquette « Essai ×10 » reste visible en haut de l'écran.

Les chiffres du jeu (coûts, durées, production, bonus des races) sont regroupés dans `src/game/config.ts`, pour pouvoir équilibrer le jeu sans toucher au reste du code.
