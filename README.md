# Game
Projet réalisé à l'aide de l'IA pour construire un jeu de A à Z. Web app dans un premier temps. Puis transformer en application mobile android Via ionic. 

#Genre
Jeu Médiéval fantastique avec dragon, mage, magie, sort, guerrier et j'en passe...
Mécaniques de jeu en temps réel : constructions, recherches, armées et combats prennent du temps.
Jeu multijoueur avec quêtes, amélioration de ville. constuction, armées, technologie, livre de sort, créature légendaire...

Les choix de conception sont détaillés dans [docs/conception.md](docs/conception.md).

## Lancer le jeu

1. Installer [Node.js](https://nodejs.org) (version 22.18 ou plus récente).
2. Dans un terminal ouvert dans ce dossier, lancer `npm install` (une seule fois), puis `npm run dev`.
3. Ouvrir l'adresse affichée dans le terminal (en général http://localhost:5173).

Pour jouer avec un compte, il faut aussi le serveur du jeu : dans un second terminal, lancer `npm run server`. Les comptes et les parties sont alors gardés dans `data/royaume.db`.

Pour lancer les tests (règles du jeu et serveur) : `npm test`.

Version finale, telle qu'un hébergeur la lancera : `npm run build`, puis `npm start` (le jeu et le serveur ensemble, sur http://localhost:3000).

