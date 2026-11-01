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
| 5 | Export MdC / Unicode / « Copier pour Claude » | ✅ |

## Utiliser l'application en ligne

**<https://cyberbobjr.github.io/hieroglyph-reader/>**

Rien à installer : ouvrez l'adresse sur votre ordinateur ou votre tablette. L'application reste
**100 % locale** : la page est seulement téléchargée depuis GitHub, puis tout se passe dans votre
navigateur. Vos photos et vos stèles ne sont jamais envoyées nulle part.

> Les stèles sont enregistrées **dans le navigateur de chaque appareil**. Pour passer de
> l'ordinateur à la tablette, utilisez « Exporter » puis « Importer un projet ».

La publication est automatique : à chaque mise à jour de la branche `main`, GitHub lance les
tests, construit l'application et la met en ligne (`.github/workflows/deploy.yml`). Réglage à
faire **une seule fois** dans le dépôt : *Settings → Pages → Build and deployment → Source :
« GitHub Actions »*.

## Installation (pour modifier le code)

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

## Prise en main en 5 minutes

1. **Une photo** : « + Nouvelle stèle depuis une photo ».
2. **Redresser** (si la photo est de biais) : `P`, placez les 4 coins, « Appliquer ».
3. **Une ligne** : choisissez le sens dans le panneau de gauche (les signes *regardent vers le
   début* de la ligne), puis `R` et glissez autour de la première ligne de texte.
4. **Les signes** : `B`, puis glissez autour d'un signe. Le curseur passe dans la saisie rapide :
   tapez `m` (ou `G17`, ou `chouette`), `Entrée`. Recommencez pour chaque signe, dans n'importe
   quel ordre : l'ordre de lecture se calcule tout seul.
5. **Un carré** (signes empilés) : `Maj`+clic sur ses signes, puis `Q`. **Un cartouche** : `K`.
   **Un doute** : tapez `G17?` (incertain) ou `//` (lacune).
6. **Le résultat** : bouton « Transcription » (ou `E`), puis **« Copier pour Claude »**, et
   collez le texte dans votre conversation.

`?` affiche à tout moment l'aide et les raccourcis.

## Guide détaillé

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
13. **Transcription** (`E`) : voir l'export ci-dessous.
14. **Sauvegarder** : c'est automatique. Pour garder une copie ou changer d'appareil, utilisez
    « JSON » (en haut) ou « Exporter » sur l'écran d'accueil : un fichier `.hieroglyph.json`
    contient le projet **et** la photo. « Importer un projet » le recharge.

> ⚠️ Effacer les données du site dans le navigateur supprime les stèles. Exportez régulièrement.

## L'export (bouton « Transcription »)

La fenêtre Transcription rassemble tout ce qui sort de l'application :

- **Copier pour Claude** : un bloc prêt à coller dans une conversation, avec le contexte (nom,
  informations sur la stèle que vous pouvez saisir, nombre de lignes, sens de lecture, nombre de
  lacunes et de signes douteux, explication de la notation), la transcription ligne par ligne
  (MdC, Unicode, liste des signes avec leurs statuts), les points d'attention, et la consigne :
  *« Donne la translittération, la traduction en français et signale les points incertains, en
  distinguant ce qui vient de ma transcription de ce qui est supposé. »*
- **Le MdC de toute la stèle**, à copier ou télécharger.
- **Pour chaque ligne** : le MdC, la chaîne Unicode (avec un aperçu orienté comme sur la stèle) et
  le tableau des signes (code, valeur, statut, carré/cartouche, note).
- **L'export JSON complet** du projet.

### La notation Manuel de Codage produite

| Écriture | Signification | Exemple |
|---|---|---|
| `-` | sépare deux cadrats | `G17-D21` |
| `:` | superpose (haut puis bas) | `X1:N35` |
| `*` | juxtapose, dans le sens de lecture | `D21*Z1` |
| `( )` | regroupe : `*` étant prioritaire sur `:`, un empilement à côté d'un signe s'écrit entre parenthèses | `M17*(X1:N35)` |
| `<-` … `->` | cartouche | `<-N5-Y5-L1->` |
| `//` | lacune (signe détruit) | `G17-//-D21` |
| `#b` … `#e` | signe restitué dans une lacune (zone hachurée) | `#b-D21-#e` |
| `!` | fin de ligne | `G17-D21-!` |
| `?` | signe tracé mais pas encore identifié — **propre à cette application** | `G17-?` |

- La disposition des carrés est **déduite de la position des boîtes** ; elle s'affiche dans le
  panneau Signe.
- Les statuts « probable » et « incertain » **ne figurent pas dans le MdC**, pour qu'il reste
  lisible par tous les outils : ils sont donnés dans la liste des signes et dans les « points
  d'attention ».
- La **chaîne Unicode est linéaire** (un signe après l'autre) : la police Noto n'affiche pas
  correctement les caractères Unicode d'empilement. Le cartouche y est représenté par 𓍹 … 𓍺
  (V11A, V11B) et une lacune par 𓑃 (U+13443, « signe perdu »).

> ℹ️ **Syntaxe à confirmer avec JSesh.** Les sites de documentation (page MdC de S. Rosmorduc,
> Wikipédia) n'étaient pas accessibles depuis l'environnement de développement. Les opérateurs de
> base (`-` `:` `*` `( )` `<-…->` `//` `!`) sont les conventions MdC classiques ; `#b…#e` est à
> vérifier dans votre version de JSesh. Si vous constatez un écart, il se corrige dans
> `src/core/mdc.ts`, et `tests/mdc.spec.ts` décrit tous les cas attendus.

## Le sens de lecture, en bref

Les signes qui ont un « devant » (oiseaux, serpents, personnages, pied, main…) **regardent
vers le début de la ligne**. La bibliothèque les montre tournés vers la gauche, comme dans
les grammaires : c'est le sens d'une lecture de gauche à droite. Sur une ligne lue de droite à
gauche, ils sont dessinés en miroir ; l'application retourne alors les glyphes des étiquettes
et du mode « comparer » pour qu'ils ressemblent à la photo. Un glyphe qui ne « regarde » pas
comme la photo signale un sens de ligne à corriger.

## La bibliothèque de signes

### Ce qu'elle contient

**Les 1 024 signes de la liste de Gardiner présents dans Unicode**, en deux niveaux :

- **119 fiches rédigées à la main** pour les signes courants : tous les unilitères
  (« alphabet »), des bilitères et trilitères fréquents, les déterminatifs usuels. Elles sont
  proposées en priorité dans la recherche.
- **905 fiches complétées automatiquement** pour tous les autres signes (E14 le chien,
  E17 le chacal, E20 l'animal séthien…) :
  - **valeurs et types** tirés des **annotations officielles Unicode** (liste des noms Unicode 17 :
    « logogram », « classifier » = déterminatif, « phonemogram ») — l'annotation d'origine est
    recopiée dans les notes de chaque fiche ;
  - **description française** rédigée pour l'application (ce que le signe représente, et son
    usage) ; « (?) » signale une apparence incertaine (environ un quart des descriptions, surtout
    des variantes rares et la série Aa).

> ⚠️ **Tout reste indicatif et marqué « à vérifier ».** Contrôlez avec la liste de Gardiner
> (*Egyptian Grammar*, 3ᵉ éd., 1957) et cliquez « Marquer vérifié » sur chaque fiche contrôlée.
> Pour reconnaître un signe, le mode « comparer » (photo à côté du glyphe) reste le meilleur juge.

Les **caractères Unicode** sont fiables : ils sont tirés automatiquement des noms
officiels Unicode (« EGYPTIAN HIEROGLYPH G017 » → G17). Les 48 enseignes de nomes (séries NL et
NU), qui ne font pas partie de la liste de Gardiner, sont laissées de côté.

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

La bibliothèque est générée par `scripts/build-sign-data.py` à partir de trois sources :

| Fichier | Contenu |
|---|---|
| liste `SIGNS` dans le script | fiches rédigées à la main (prioritaires) |
| `scripts/data/unicode-annotations.json` | annotations officielles Unicode (valeurs, types) |
| `scripts/data/descriptions-fr.json` | descriptions françaises des autres signes |

Pour rédiger ou corriger la fiche d'un signe courant, ajoutez une ligne à `SIGNS` :

```python
("G18", ["mm"], ["biliteral"], "deux chouettes"),
```

Pour corriger seulement une description, modifiez `scripts/data/descriptions-fr.json`. Lancez
ensuite `python3 scripts/build-sign-data.py`, qui vérifie les codes et régénère
`src/data/signs.seed.json`, puis `npm test`.

Les annotations Unicode se régénèrent avec `scripts/extract-unicode-annotations.py` (voir
l'en-tête du script).

## Organisation du code

```
src/
  types/models.ts        Modèle de données (Projet, Ligne, Boîte, Signe…)
  core/                  Logique pure, testée : perspective, filtres, géométrie, lignes,
                         codes Gardiner, translittération, recherche, ordre de lecture,
                         disposition des carrés, boîtes et groupes, MdC, bloc « pour Claude »
  data/                  Bibliothèque de départ et table Unicode (générées)
  workers/               Calculs d'image en arrière-plan (Web Worker)
  persistence/           IndexedDB, import/export JSON
  stores/                État Pinia : liste des stèles, stèle ouverte, historique, interface
  composables/           Zoom/déplacement, raccourcis clavier
  components/            Interface Vue
tests/                   Tests unitaires (Vitest)
scripts/                 Génération des données de signes
```

## Limites connues

- Pas de reconnaissance automatique ni de traduction : c'est voulu.
- Sur tablette en portrait, les panneaux latéraux sont des tiroirs (boutons « Lignes » et
  « Signes ») ; en paysage, tout est visible.
- Changer la perspective après avoir tracé des lignes les décale (un avertissement le rappelle).
- Une ligne dont l'ordre a été corrigé à la main n'est plus réordonnée automatiquement
  (« Revenir à l'ordre automatique » dans le panneau Signe).

## Licences

- Police **Noto Sans Egyptian Hieroglyphs** : SIL Open Font License 1.1, incluse dans
  l'application (voir `licenses/OFL-Noto-Sans-Egyptian-Hieroglyphs.txt`).
- Annotations des signes : **Unicode® Character Database**, © Unicode, Inc., licence Unicode v3
  (<https://www.unicode.org/license.txt>).
