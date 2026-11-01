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
| 2 | Découpage en lignes (rectangle/polygone, sens de lecture, colonnes) | ✅ |
| 3 | Bibliothèque de signes Gardiner | ✅ |
| 4 | Placement des signes, carrés, cartouches, statuts, saisie rapide, comparer | ✅ |
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

## Prise en main

1. **Nouvelle stèle** : sur l'écran d'accueil, cliquez « Nouvelle stèle depuis une photo » (ou
   déposez la photo sur la page).
2. **Se déplacer** : glissez pour déplacer, molette ou pincement pour zoomer, double-clic pour
   zoomer à un endroit. Touches `+`, `−`, `0` (ajuster), `1` (taille réelle).
3. **Redresser la photo** (`P`) : placez les 4 poignées sur les coins de la stèle, puis
   « Appliquer ». Une loupe aide à viser. Faites-le **avant** de tracer les lignes.
   - Les poignées peuvent sortir de la photo (coin hors cadre, perspective très prononcée).
   - **Proportions** du résultat : *automatiques* (calculées d'après la forme des coins, en
     supposant que la photo n'a pas été recadrée), *dimensions réelles* (si vous connaissez la
     largeur et la hauteur de la stèle : le plus fiable) ou *réglage manuel*.
4. **Filtres** (`F`) : niveaux de gris, contraste automatique, inversion, luminosité, contraste,
   accentuation du relief (« netteté » ou « lumière rasante »). L'original n'est jamais modifié.
5. **Loupe** (`L`) : une fenêtre agrandie suit le curseur (sur tablette : sous le doigt).
6. **Découper en lignes** (panneau « Lignes » à gauche) :
   - `R` **Rectangle** : glissez autour d'une ligne de texte. `G` **Polygone** : un clic par
     sommet, puis Entrée, double-clic ou clic sur le premier point pour fermer (utile pour une
     ligne courbe ou penchée). Sur tablette : un doigt trace, deux doigts déplacent/zooment.
   - Choisissez d'abord le **sens des nouvelles lignes**. Repère : les signes *regardent vers le
     début de la ligne*.
   - Une forme haute et étroite devient automatiquement une **colonne** (lue de haut en bas).
   - `V` **Sélection** : touchez une ligne pour la sélectionner. Glissez sa pastille ✥ pour la
     déplacer, ses carrés jaunes pour la déformer. Dans le panneau : numéro, sens, type
     (ligne/colonne), ordre, suppression (`Suppr`).
   - « Actions sur toutes les lignes » : renuméroter selon la position, changer le sens de tout.
7. **Bibliothèque de signes** (panneau de droite, `/` pour rechercher) : tapez un code
   (`G17`), une valeur phonétique (`m`, `nfr`) ou un mot (`chouette`). Filtres par catégorie,
   type et vérification. Cliquez un résultat pour voir sa fiche.
8. **Placer les signes** (`B`, outil « Boîte de signe ») : glissez autour de chaque signe, à
   l'intérieur d'une ligne. Pas besoin de suivre un ordre : l'**ordre de lecture se calcule
   seul** selon le sens de la ligne (signes empilés lus de haut en bas). Corrigez-le si besoin
   avec « Plus tôt / Plus tard » dans le panneau Signe.
9. **Identifier les signes au clavier** (saisie rapide, sous la photo) : dès qu'une boîte est
   tracée ou sélectionnée (`Entrée`), tapez `m`, `G17` ou `chouette`, choisissez avec `↑` `↓`,
   validez avec `Entrée` : on passe à la boîte suivante. `G17?` = incertain, `//` = lacune.
   Le morceau de photo et le glyphe proposé sont affichés côte à côte (« comparer »).
10. **Grouper** : `Maj`+clic sur plusieurs boîtes (sur tablette : « Sélection multiple »), puis
    `Q` pour un **carré** ou `K` pour un **cartouche**.
11. **Statut et note** de chaque signe : certain, probable, incertain, lacune (couleur du cadre :
    vert, bleu, orange, rouge), plus une note libre.
12. **Annuler / rétablir** : `Ctrl+Z` / `Ctrl+Maj+Z` (⌘ sur Mac), ou les boutons en haut.
13. **Sauvegarder** : c'est automatique. Pour garder une copie ou changer d'appareil, utilisez
   « Exporter » : un fichier `.hieroglyph.json` contient le projet **et** la photo.
   « Importer un projet » le recharge.

> ⚠️ Effacer les données du site dans le navigateur supprime les stèles. Exportez régulièrement.

## Le sens de lecture, en bref

Les signes qui ont un « devant » (oiseaux, serpents, personnages, pied, main…) **regardent
vers le début de la ligne**. La bibliothèque les montre tournés vers la gauche, comme dans
les grammaires : c'est le sens d'une lecture de gauche à droite. Sur une ligne lue de droite à
gauche, ils sont dessinés en miroir ; l'application retourne alors les glyphes des étiquettes
et du mode « comparer » pour qu'ils ressemblent à la photo. Un glyphe qui ne « regarde » pas
comme la photo signale un sens de ligne à corriger.

## La bibliothèque de signes

### Ce qu'elle contient

- **119 signes de départ** : tous les unilitères (« alphabet »), des bilitères et trilitères
  courants, les déterminatifs fréquents.
- Pour chacun : glyphe Unicode, code Gardiner, valeurs de translittération, type (idéogramme,
  unilitère, bilitère, trilitère, déterminatif), courte description en français.

> ⚠️ **Ces valeurs sont indicatives et toutes marquées « à vérifier ».** Elles ont été
> préparées sans relecture par un spécialiste. Contrôlez-les avec la liste de Gardiner
> (*Egyptian Grammar*, 3ᵉ éd., 1957) et cliquez « Marquer vérifié » sur chaque fiche contrôlée.

Les **caractères Unicode**, eux, sont fiables : ils sont tirés automatiquement des noms
officiels Unicode (« EGYPTIAN HIEROGLYPH G017 » → G17), pour les 1 024 signes Gardiner du bloc.

### Écrire la translittération

L'application affiche l'écriture égyptologique (ꜣ ꜥ ḥ ḫ ẖ š ṯ ḏ…) et accepte aussi
l'écriture **Manuel de Codage**, tapable au clavier :

| MdC | `A` | `a` | `i` | `H` | `x` | `X` | `S` | `T` | `D` |
|---|---|---|---|---|---|---|---|---|---|
| Égyptologique | ꜣ | ꜥ | j | ḥ | ḫ | ẖ | š | ṯ | ḏ |

Attention : en MdC, `h` et `H` sont deux sons différents. La recherche propose d'abord la valeur
exacte, puis les valeurs proches.

## Ajouter des signes à la bibliothèque

**Depuis l'application (recommandé)**

1. Cliquez « + Ajouter un signe » en bas du panneau Bibliothèque.
   Astuce : tapez d'abord le code dans la recherche (ex. `G18`) ; s'il existe dans Unicode
   mais pas dans la bibliothèque, un bouton « L'ajouter » pré-remplit le formulaire.
2. Saisissez le code Gardiner : le glyphe Unicode et la catégorie se remplissent seuls.
3. Ajoutez les valeurs, séparées par des virgules (MdC accepté : `anx` devient `ꜥnḫ`),
   cochez le ou les types, écrivez une description en français.
4. « Enregistrer ». Le signe est gardé dans ce navigateur. Modifier un signe de départ crée
   votre version ; « Rétablir l'original » l'efface.

Ajouts et modifications s'annulent avec `Ctrl+Z`. **Exporter** télécharge toute la
bibliothèque en JSON (pour la sauvegarder ou la partager) ; **Importer** la recharge sur un
autre appareil.

**Dans le code (pour tout le monde)**

La bibliothèque de départ est générée par `scripts/build-sign-data.py`. Ajoutez une ligne à
la liste `SIGNS` :

```python
("G18", ["mm"], ["biliteral"], "deux chouettes"),
```

puis lancez `python3 scripts/build-sign-data.py`. Le script vérifie que le code existe dans
Unicode, remplit le glyphe et régénère `src/data/signs.seed.json`. `npm test` vérifie ensuite
la cohérence de la bibliothèque.

## Organisation du code

```
src/
  types/models.ts        Modèle de données (Projet, Ligne, Boîte, Signe…)
  core/                  Logique pure, testée : perspective, filtres, géométrie, lignes,
                         codes Gardiner, translittération, recherche, ordre de lecture,
                         disposition des carrés, boîtes et groupes
  data/                  Bibliothèque de départ et table Unicode (générées)
  workers/               Calculs d'image en arrière-plan (Web Worker)
  persistence/           IndexedDB, import/export JSON
  stores/                État Pinia : liste des stèles, stèle ouverte, historique, interface
  composables/           Zoom/déplacement, raccourcis clavier
  components/            Interface Vue
tests/                   Tests unitaires (Vitest)
scripts/                 Génération des données de signes
```

## Licences

- Police **Noto Sans Egyptian Hieroglyphs** : SIL Open Font License 1.1, incluse dans
  l'application (voir `licenses/OFL-Noto-Sans-Egyptian-Hieroglyphs.txt`).
