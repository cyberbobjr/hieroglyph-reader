# Hieroglyph Reader

Atelier **local** pour transcrire une stèle égyptienne signe par signe à partir d'une photo.
Vous lisez la stèle vous-même et identifiez chaque signe (classification de Gardiner).
L'application produit une transcription propre (Manuel de Codage, Unicode) que vous pouvez coller
dans une conversation avec une IA pour obtenir la translittération et la traduction.

- **Aucun serveur** : la photo ne quitte jamais votre appareil.
- Les stèles sont enregistrées dans le navigateur (IndexedDB). Vous pouvez en garder **plusieurs**.
- Fonctionne sur ordinateur et sur tablette (pincer pour zoomer, glisser pour déplacer).

> L'application ne traduit rien et ne reconnaît pas les signes automatiquement : c'est un outil
> d'aide à la saisie.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Visionneuse : zoom/déplacement, perspective 4 points, filtres, loupe, plusieurs stèles | ✅ |
| 2 | Découpage en lignes (rectangle/polygone, sens de lecture, colonnes) | à venir |
| 3 | Bibliothèque de signes Gardiner | à venir |
| 4 | Placement des signes, carrés, cartouches, statuts, saisie rapide | à venir |
| 5 | Export MdC / Unicode / « Copier pour Claude » | à venir |

## Installation

Il faut [Node.js](https://nodejs.org/) version 20 ou plus récente.

```bash
git clone https://github.com/cyberbobjr/hieroglyph-reader.git
cd hieroglyph-reader
npm install
npm run dev
```

Ouvrez ensuite l'adresse affichée (en général <http://localhost:5173>).

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run build` | Vérifie les types et fabrique la version finale dans `dist/` |
| `npm run preview` | Sert la version finale localement |
| `npm test` | Lance les tests unitaires |

Pour utiliser l'application sur une tablette du même réseau Wi-Fi : `npm run dev -- --host`, puis
ouvrez sur la tablette l'adresse « Network » affichée.

## Prise en main (étape 1)

1. **Nouvelle stèle** : sur l'écran d'accueil, cliquez « Nouvelle stèle depuis une photo » (ou
   déposez la photo sur la page).
2. **Se déplacer** : glissez pour déplacer, molette ou pincement pour zoomer, double-clic pour
   zoomer à un endroit. Touches `+`, `−`, `0` (ajuster), `1` (taille réelle).
3. **Redresser la photo** (`P`) : placez les 4 poignées sur les coins de la stèle, puis
   « Appliquer ». Une loupe aide à viser. Faites-le **avant** de tracer les lignes.
4. **Filtres** (`F`) : niveaux de gris, contraste automatique, inversion, luminosité, contraste,
   accentuation du relief (« netteté » ou « lumière rasante »). L'original n'est jamais modifié.
5. **Loupe** (`L`) : une fenêtre agrandie suit le curseur (sur tablette : sous le doigt).
6. **Annuler / rétablir** : `Ctrl+Z` / `Ctrl+Maj+Z` (⌘ sur Mac), ou les boutons en haut.
7. **Sauvegarder** : c'est automatique. Pour garder une copie ou changer d'appareil, utilisez
   « Exporter » : un fichier `.hieroglyph.json` contient le projet **et** la photo.
   « Importer un projet » le recharge.

> ⚠️ Effacer les données du site dans le navigateur supprime les stèles. Exportez régulièrement.

## Organisation du code

```
src/
  types/models.ts        Modèle de données (Projet, Ligne, Boîte, Signe…)
  core/                  Logique pure, testée : perspective, filtres, identifiants
  workers/               Calculs d'image en arrière-plan (Web Worker)
  persistence/           IndexedDB, import/export JSON
  stores/                État Pinia : liste des stèles, stèle ouverte, historique, interface
  composables/           Zoom/déplacement, raccourcis clavier
  components/            Interface Vue
tests/                   Tests unitaires (Vitest)
```

## Licences

- Police **Noto Sans Egyptian Hieroglyphs** : SIL Open Font License 1.1, incluse dans
  l'application (voir `licenses/OFL-Noto-Sans-Egyptian-Hieroglyphs.txt`).
