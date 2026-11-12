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
- **[Décidé]** Pas de tour par tour : les combats aussi se déroulent en temps réel. Pour commencer simple, l'armée met un certain temps à atteindre sa cible, puis la bataille se calcule automatiquement et produit un rapport de bataille. Plus tard, les batailles pourront durer sur la carte.

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
- **[Décidé]** Bâtiments suivants : Caserne (troupes), Académie (recherches), Tour des mages (sorts), Remparts (défense).
- **[Décidé]** L'**Académie** (débloquée au Château niveau 3) mène les recherches : une à la fois, et aucune recherche ne dépasse le niveau de l'Académie.
- **[Proposition]** Huit recherches pour commencer : Agriculture (nourriture), Outils de qualité (bois et pierre), Alchimie (or et mana), Forge (attaque des troupes), Armures (vie des troupes), Maçonnerie (constructions plus rapides), Marche forcée (marche plus rapide) et Commandement (une armée de plus en campagne par niveau).

## 6. Armées et héros

- **[Décidé]** Quatre familles de troupes : Guerriers, Archers, Cavaliers et Mages, avec des forces et des faiblesses entre elles.
- **[Proposition]** Les forces et faiblesses forment un cycle : Guerriers > Cavaliers > Archers > Mages > Guerriers. Une troupe inflige 50 % de dégâts en plus à la famille qu'elle domine.
- **[Décidé]** On peut entraîner plusieurs troupes en même temps.
- **[Proposition]** À la Caserne, chaque type de troupe s'entraîne de son côté : un entraînement à la fois par type, donc jusqu'à quatre en parallèle. Le niveau de la Caserne débloque les Cavaliers (niveau 2) et les Mages (niveau 3), augmente le nombre de troupes par entraînement et accélère l'entraînement.
- **[Proposition]** Les batailles se jouent en manches, sans hasard : les mêmes armées donnent toujours le même résultat.
- **[Décidé]** Chaque rapport de bataille contient le journal du combat : qui avait l'avantage, puis chaque manche (dégâts infligés de chaque côté, pertes, troupes restantes), puis l'issue.
- **[Décidé]** Les troupes mangent : chaque troupe consomme de la nourriture chaque heure, dans la cité comme en campagne. Une grosse armée coûte donc cher à garder.
- **[Décidé]** Si les réserves de nourriture sont vides et que les fermes ne suffisent plus, c'est la famine. Personne ne déserte, mais les troupes ont faim et se battent moins bien.
- **[Proposition]** Des troupes affamées perdent 30 % de leur attaque au combat. Pour sortir de la famine, on améliore sa Ferme ou on renvoie des troupes : les troupes renvoyées ne mangent plus, mais elles quittent l'armée.
- **[Décidé]** Des **héros** mènent les armées ; ils gagnent de l'expérience et débloquent des compétences.
- **[Décidé]** Des **créatures légendaires** (dragons…) : rares, très puissantes, obtenues par des quêtes.

## 7. Le monde

- **[Décidé]** Une carte commune à tous les joueurs d'un serveur : cités, gisements de ressources, monstres, lieux légendaires.
- **[Décidé]** Des **alliances** : entraide, attaques groupées, territoire commun.
- **[Proposition]** En attendant la carte (étape 4), des camps de monstres « aux alentours » de la cité : Tanière de loups, Campement gobelin, Ruines hantées et Antre du troll. L'armée met du temps à y aller et à en revenir, la bataille a lieu à l'arrivée, et une victoire rapporte un butin.
- **[Décidé]** Plusieurs armées peuvent être en campagne en même temps, de plus en plus au fil des recherches.
- **[Proposition]** Une armée au départ, plus une par niveau de Commandement (trois au maximum pour l'instant), et une seule armée à la fois vers un même camp.

## 8. Les cartes

- **[Décidé]** Le jeu se voit sur des cartes : la cité (chaque bâtiment sur son emplacement, dans l'enceinte) et ses alentours (les camps de monstres, les armées en marche). On s'y promène en faisant glisser la carte, et on zoome avec deux doigts, la molette ou les boutons.
- **[Proposition]** Toucher un bâtiment ou un camp affiche sa fiche sous la carte ; une liste de pastilles permet aussi de les choisir sans chercher sur la carte. Les emojis seront remplacés par les images du guide graphique.

## 9. Les comptes et le serveur

- **[Décidé]** Le serveur garde les parties et applique lui-même les règles du jeu. Le navigateur n'envoie que des ordres (« améliorer la Ferme », « entraîner 20 archers »…) : impossible de tricher en modifiant le jeu dans son navigateur.
- **[Proposition]** Un compte, c'est un nom de joueur (unique, et visible des autres joueurs) et un mot de passe. Pas d'adresse e-mail pour l'instant : le serveur ne garde rien de personnel, mais un mot de passe oublié ne peut pas être récupéré.
- **[Proposition]** On peut toujours jouer sans compte : la partie reste sur l'appareil. Elle ne peut pas passer en ligne ensuite, sinon on pourrait la modifier avant de l'envoyer.
- **[À trancher]** Où héberger le serveur.

## 10. Feuille de route

Chaque étape donne un jeu jouable.

1. **Prototype solo dans le navigateur** : la cité, les ressources, les bâtiments et leurs durées de construction. *En place* : choix de la race, cinq ressources, six bâtiments, un chantier à la fois, production hors connexion.
2. **Armées** : troupes, recherches, combats contre des monstres. *En place* : Caserne, quatre troupes, camps de monstres, rapports de bataille, Académie et recherches, plusieurs armées en campagne, cartes de la cité et des alentours.
3. **Serveur et comptes joueurs** : sauvegarde en ligne ; le serveur décide de tout. *En cours* : comptes (nom et mot de passe), parties gardées sur le serveur, qui applique les règles, et partie sans compte toujours possible. Reste à mettre le jeu en ligne chez un hébergeur.
4. **Monde partagé** : la carte, les attaques entre joueurs, les alliances.
5. **Contenu et mobile** : quêtes, livre de sorts, créatures légendaires, puis l'appli Android.

Les chiffres du jeu (coûts, durées, production, bonus des races) sont regroupés dans `src/game/config.ts`, pour pouvoir équilibrer le jeu sans toucher au reste du code.
