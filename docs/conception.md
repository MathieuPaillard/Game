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

## 6. Armées et héros

- **[Décidé]** Quatre familles de troupes : Guerriers, Archers, Cavaliers et Mages, avec des forces et des faiblesses entre elles.
- **[Décidé]** Des **héros** mènent les armées ; ils gagnent de l'expérience et débloquent des compétences.
- **[Décidé]** Des **créatures légendaires** (dragons…) : rares, très puissantes, obtenues par des quêtes.

## 7. Le monde

- **[Décidé]** Une carte commune à tous les joueurs d'un serveur : cités, gisements de ressources, monstres, lieux légendaires.
- **[Décidé]** Des **alliances** : entraide, attaques groupées, territoire commun.

## 8. Feuille de route

Chaque étape donne un jeu jouable.

1. **Prototype solo dans le navigateur** : la cité, les ressources, les bâtiments et leurs durées de construction. *En place* : choix de la race, cinq ressources, six bâtiments, un chantier à la fois, production hors connexion.
2. **Armées** : troupes, recherches, combats contre des monstres.
3. **Serveur et comptes joueurs** : sauvegarde en ligne ; le serveur décide de tout.
4. **Monde partagé** : la carte, les attaques entre joueurs, les alliances.
5. **Contenu et mobile** : quêtes, livre de sorts, créatures légendaires, puis l'appli Android.

Les chiffres du jeu (coûts, durées, production, bonus des races) sont regroupés dans `src/game/config.ts`, pour pouvoir équilibrer le jeu sans toucher au reste du code.
