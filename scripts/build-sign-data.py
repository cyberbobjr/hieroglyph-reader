#!/usr/bin/env python3
"""
Génère les données de signes de Hieroglyph Reader.

1. src/data/unicodeGardiner.json : correspondance code Gardiner → caractère
   Unicode, pour les 1072 signes du bloc « Egyptian Hieroglyphs »
   (U+13000–U+1342F). Elle est tirée des NOMS OFFICIELS Unicode
   (« EGYPTIAN HIEROGLYPH G017 » → G17), donc sans risque de faute de frappe.

2. src/data/signs.seed.json : la bibliothèque de départ, avec TOUS les signes :
   - les signes courants de la liste SIGNS ci-dessous, rédigés à la main ;
   - tous les autres, complétés automatiquement : valeurs et types tirés des
     annotations officielles Unicode (scripts/data/unicode-annotations.json),
     descriptions françaises de scripts/data/descriptions-fr.json.
   Tout est INDICATIF et marqué « à vérifier » (verified = false). Contrôlez
   avec la liste de Gardiner (Egyptian Grammar, 3e éd., 1957).

Utilisation : python3 scripts/build-sign-data.py
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"


def unicode_name_to_code(name: str) -> str | None:
    # Les 48 enseignes de nomes (séries NL et NU) ne font pas partie de la
    # liste de Gardiner : elles sont volontairement ignorées.
    m = re.fullmatch(r"EGYPTIAN HIEROGLYPH (AA|[A-Z])(\d{3})([A-Z]*)", name)
    if not m:
        return None
    cat, num, suffix = m.groups()
    cat = "Aa" if cat == "AA" else cat
    return f"{cat}{int(num)}{suffix}"


def build_unicode_table() -> dict[str, str]:
    table = {}
    for cp in range(0x13000, 0x13430):
        name = unicodedata.name(chr(cp), "")
        code = unicode_name_to_code(name)
        if code:
            table[code] = chr(cp)
    return table


# Translittération en caractères égyptologiques Unicode :
#   ꜣ (aleph)  j  y  ꜥ (ayin)  w b p f m n r h  ḥ ḫ ẖ  s z š q k g t ṯ d ḏ
# kind : ideogram, uniliteral, biliteral, triliteral, determinative
SIGNS = [
    # --- Unilitères (« alphabet ») -----------------------------------------
    ("G1", ["ꜣ"], ["uniliteral"], "vautour percnoptère"),
    ("M17", ["j"], ["uniliteral"], "roseau fleuri (feuille de roseau)"),
    ("M17A", ["y"], ["uniliteral"], "deux roseaux fleuris"),
    ("Z4", ["y"], ["uniliteral"], "deux traits obliques (forme hiératique du double roseau)"),
    ("D36", ["ꜥ"], ["uniliteral"], "avant-bras, paume vers le haut"),
    ("G43", ["w"], ["uniliteral"], "poussin de caille"),
    ("Z7", ["w"], ["uniliteral"], "spirale (forme hiératique du poussin de caille)"),
    ("D58", ["b"], ["uniliteral"], "pied (jambe et pied)"),
    ("Q3", ["p"], ["uniliteral"], "tabouret ou natte de roseaux"),
    ("I9", ["f"], ["uniliteral"], "vipère à cornes (céraste)"),
    ("G17", ["m"], ["uniliteral"], "chouette (hibou)"),
    ("N35", ["n"], ["uniliteral"], "filet d'eau (ondulation)"),
    ("S3", ["n"], ["uniliteral", "ideogram"], "couronne rouge de Basse-Égypte"),
    ("D21", ["r"], ["uniliteral"], "bouche"),
    ("O4", ["h"], ["uniliteral"], "abri de roseaux (cour)"),
    ("V28", ["ḥ"], ["uniliteral"], "mèche de lin tressée"),
    ("Aa1", ["ḫ"], ["uniliteral"], "placenta (ou crible) : disque rond hachuré"),
    ("F32", ["ẖ"], ["uniliteral"], "ventre et mamelles d'animal, avec la queue"),
    ("O34", ["z"], ["uniliteral"], "verrou de porte"),
    ("S29", ["s"], ["uniliteral"], "étoffe pliée"),
    ("N37", ["š"], ["uniliteral"], "bassin rempli d'eau"),
    ("N29", ["q"], ["uniliteral"], "pente de colline sableuse"),
    ("V31", ["k"], ["uniliteral"], "corbeille à anse"),
    ("W11", ["g"], ["uniliteral"], "support de jarre"),
    ("X1", ["t"], ["uniliteral"], "petit pain (demi-cercle aplati)"),
    ("V13", ["ṯ"], ["uniliteral"], "entrave (corde pour attacher le bétail)"),
    ("D46", ["d"], ["uniliteral"], "main"),
    ("I10", ["ḏ"], ["uniliteral"], "cobra dressé"),
    # --- Bilitères -----------------------------------------------------------
    ("D4", ["jr"], ["biliteral", "ideogram"], "œil ; idéogramme « œil », bilitère jr (« faire »)"),
    ("D28", ["kꜣ"], ["biliteral", "ideogram"], "deux bras levés : le ka"),
    ("D35", ["n"], ["uniliteral"], "deux bras tendus en geste de négation"),
    ("E23", ["rw"], ["biliteral"], "lion couché"),
    ("E34", ["wn"], ["biliteral"], "lièvre"),
    ("F31", ["ms"], ["biliteral"], "trois peaux de renard liées"),
    ("F36", ["smꜣ"], ["biliteral"], "poumons et trachée"),
    ("G4", ["tjw"], ["biliteral"], "buse"),
    ("G21", ["nḥ"], ["biliteral"], "pintade"),
    ("G25", ["ꜣḫ"], ["biliteral"], "ibis chevelu"),
    ("G36", ["wr"], ["biliteral"], "hirondelle"),
    ("G39", ["zꜣ"], ["biliteral"], "canard pilet (« fils »)"),
    ("G40", ["pꜣ"], ["biliteral"], "canard pilet en vol"),
    ("G47", ["ṯꜣ"], ["biliteral"], "caneton"),
    ("I6", ["km"], ["biliteral"], "morceau de peau de crocodile"),
    ("K1", ["jn"], ["biliteral"], "poisson bulti (tilapia)"),
    ("M8", ["šꜣ"], ["biliteral"], "bassin avec fleurs de lotus"),
    ("M12", ["ḫꜣ"], ["biliteral", "ideogram"], "plante de lotus (aussi « mille »)"),
    ("M23", ["sw"], ["biliteral"], "plante du Sud (jonc)"),
    ("N14", ["sbꜣ", "dwꜣ"], ["biliteral", "ideogram"], "étoile"),
    ("N18", ["jw"], ["biliteral", "ideogram"], "île (bande de sable)"),
    ("O1", ["pr"], ["biliteral", "ideogram"], "plan de maison"),
    ("O29", ["ꜥꜣ"], ["biliteral"], "colonne de bois (« grand »)"),
    ("O50", ["sp"], ["biliteral"], "aire de battage (cercle avec grains ou croix)"),
    ("Q1", ["st", "ws"], ["biliteral", "ideogram"], "siège (trône)"),
    ("U1", ["mꜣ"], ["biliteral"], "faucille"),
    ("U7", ["mr"], ["biliteral"], "houe"),
    ("U33", ["tj"], ["biliteral"], "pilon"),
    ("U36", ["ḥm"], ["biliteral"], "massue de foulon"),
    ("V4", ["wꜣ"], ["biliteral"], "lasso"),
    ("V30", ["nb"], ["biliteral"], "corbeille (« seigneur », « tout »)"),
    ("W19", ["mj"], ["biliteral"], "cruche à lait dans un filet"),
    ("W24", ["nw"], ["biliteral"], "pot globulaire"),
    ("W25", ["jn"], ["biliteral"], "pot à jambes (« apporter »)"),
    ("X8", ["dj", "rdj"], ["biliteral"], "pain conique (« donner »)"),
    ("Y5", ["mn"], ["biliteral"], "damier de jeu (senet)"),
    ("Aa11", ["mꜣꜥ"], ["triliteral"], "socle (« juste, vrai »)"),
    ("D1", ["tp"], ["ideogram", "biliteral"], "tête de profil"),
    ("D2", ["ḥr"], ["ideogram", "biliteral"], "visage de face"),
    ("D37", ["dj", "rdj"], ["biliteral"], "bras tendant un pain conique (« donner »)"),
    ("F4", ["ḥꜣt"], ["ideogram"], "avant-train de lion (« devant, début »)"),
    ("F12", ["wsr"], ["triliteral"], "tête et cou de canidé (« puissant »)"),
    ("F13", ["wp"], ["biliteral"], "cornes de bovin (« ouvrir »)"),
    ("N1", ["pt"], ["ideogram", "determinative"], "ciel ; déterminatif du ciel et de ce qui est en haut"),
    ("N5", ["rꜥ"], ["ideogram", "determinative"], "soleil (cercle avec un point au centre) ; déterminatif du temps"),
    ("N16", ["tꜣ"], ["ideogram", "biliteral"], "terre plate avec grains de sable"),
    ("N26", ["ḏw"], ["ideogram", "biliteral"], "montagne"),
    ("N35A", ["mw"], ["ideogram", "biliteral", "determinative"], "trois filets d'eau ; « eau », déterminatif des liquides"),
    ("O28", ["jwn"], ["triliteral"], "colonne"),
    ("P8", ["ḫrw"], ["determinative", "triliteral"], "rame (« voix », dans mꜣꜥ-ḫrw « juste de voix »)"),
    ("V7", ["šn"], ["biliteral"], "corde enroulée"),
    ("H6", ["mꜣꜥt", "šw"], ["ideogram", "biliteral"], "plume (Maât)"),
    ("G14", ["mwt", "nr"], ["ideogram", "biliteral"], "vautour (« mère »)"),
    ("G5", ["ḥr"], ["ideogram"], "faucon : le dieu Horus"),
    # --- Trilitères ----------------------------------------------------------
    ("S34", ["ꜥnḫ"], ["triliteral", "ideogram"], "croix ansée : « vie »"),
    ("F35", ["nfr"], ["triliteral"], "cœur et trachée (« bon, beau »)"),
    ("R4", ["ḥtp"], ["triliteral", "ideogram"], "pain sur une natte d'offrande (« offrande, être satisfait »)"),
    ("R8", ["nṯr"], ["triliteral", "ideogram"], "étoffe sur une hampe : « dieu »"),
    ("R11", ["ḏd"], ["biliteral", "ideogram"], "pilier djed (« stabilité »)"),
    ("S38", ["ḥqꜣ"], ["triliteral", "ideogram"], "sceptre-crosse court (crochet recourbé) : « gouverner »"),
    ("S12", ["nbw"], ["triliteral", "ideogram"], "collier : « or »"),
    ("L1", ["ḫpr"], ["triliteral"], "scarabée (« devenir, exister »)"),
    ("W9", ["ẖnm"], ["triliteral"], "cruche à anse (dieu Khnoum)"),
    ("O42", ["šzp"], ["triliteral"], "clôture (« recevoir »)"),
    # --- Déterminatifs fréquents --------------------------------------------
    ("A1", ["j"], ["determinative", "uniliteral"], "homme assis ; déterminatif de l'homme ; pronom « je »"),
    ("A2", [], ["determinative"], "homme portant la main à la bouche : manger, parler, penser"),
    ("A17", ["ẖrd"], ["determinative", "ideogram"], "enfant assis, doigt à la bouche : enfance"),
    ("A24", [], ["determinative"], "homme frappant avec un bâton : force, effort"),
    ("A30", [], ["determinative"], "homme les bras levés : adoration, prière"),
    ("A40", [], ["determinative"], "dieu assis : divinités ; pronom « je » d'un dieu"),
    ("B1", [], ["determinative"], "femme assise : déterminatif de la femme"),
    ("D3", [], ["determinative"], "mèche de cheveux : chevelure, deuil, manque"),
    ("D40", [], ["determinative"], "bras tenant un bâton : force, effort"),
    ("D54", [], ["determinative"], "jambes en marche : mouvement"),
    ("E1", ["kꜣ"], ["determinative", "ideogram"], "taureau : bétail"),
    ("F51", [], ["determinative"], "morceau de chair : parties du corps"),
    ("G7", [], ["determinative"], "faucon sur un pavois : dieux, roi"),
    ("G37", [], ["determinative"], "moineau : petit, mauvais, faible"),
    ("M1", [], ["determinative"], "arbre : arbres, bois"),
    ("M2", [], ["determinative"], "plante : plantes, fleurs"),
    ("N25", ["ḫꜣst"], ["determinative", "ideogram"], "trois collines : désert, pays étranger"),
    ("N33", [], ["determinative"], "grain de sable (petit cercle) : minéraux, médicaments"),
    ("O39", [], ["determinative"], "bloc de pierre : pierre"),
    ("O49", ["njwt"], ["determinative", "ideogram"], "carrefour dans un cercle : ville, localité"),
    ("P1", [], ["determinative"], "bateau : bateaux, navigation"),
    ("T14", [], ["determinative"], "bâton de jet : étrangers, peuples ennemis"),
    ("V10", ["šnw"], ["determinative"], "cartouche : entoure les noms royaux"),
    ("Y1", [], ["determinative"], "rouleau de papyrus scellé : idées abstraites, écriture"),
    ("Z1", [], ["ideogram"], "trait vertical : marque qu'un signe est employé comme idéogramme ; « un »"),
    ("Z2", [], ["determinative"], "trois traits : pluriel"),
    ("Z3", [], ["determinative"], "trois traits superposés : pluriel"),
]

CATEGORIES = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Aa",
]


def category_of(code: str) -> str:
    return "Aa" if code.startswith("Aa") else code[0]


# --- Signes complétés automatiquement --------------------------------------
# Pour les signes sans fiche rédigée à la main, les valeurs et le type viennent
# des annotations officielles Unicode (scripts/data/unicode-annotations.json) et
# la description française de scripts/data/descriptions-fr.json.
FUNC = re.compile(
    r"^(logogram/phonemogram|logogram|clas+ifier|phonemogram|phono-repeater)\b\s*(?:\(([^)]*)\))?\s*([^:]*?)\s*(?::\s*(.+))?$"
)


def norm_translit(t: str) -> str:
    """Notation Unicode → notation de l'application (ꞽ → j, ḳ → q)."""
    return t.replace("ꞽ", "j").replace("Ꞽ", "j").replace("ḳ", "q").replace("ỉ", "j").strip()


def consonants(t: str) -> int:
    return len(re.sub(r"[.\-=()\s]", "", t))


def parse_annotation(comments: list[str]) -> tuple[list[str], list[str]]:
    """Annotation Unicode → (types, valeurs). Les classificateurs n'ont pas de valeur propre."""
    kinds: list[str] = []
    values: list[str] = []
    for c in comments:
        m = FUNC.match(c)
        if not m:
            continue
        func, _paren, _rest, val = m.groups()
        vals = [norm_translit(v) for v in re.split(r"\s*(?:/|,|\bor\b)\s*", val or "") if v.strip()]
        if func.startswith("clas"):
            kinds.append("determinative")
            continue
        if func.startswith("logogram"):
            kinds.append("ideogram")
            values += vals
        if func in ("phonemogram", "phono-repeater", "logogram/phonemogram"):
            for v in vals:
                n = consonants(v)
                kinds.append("uniliteral" if n == 1 else "biliteral" if n == 2 else "triliteral")
            if func != "logogram/phonemogram":
                values += vals
    dedup = lambda xs: list(dict.fromkeys(xs))
    return dedup(kinds), dedup(values)


def main():
    table = build_unicode_table()
    (DATA / "unicodeGardiner.json").write_text(
        json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    by_char = {ch: code for code, ch in table.items()}
    annotations = json.loads((ROOT / "scripts" / "data" / "unicode-annotations.json").read_text(encoding="utf-8"))["annotations"]
    desc_path = ROOT / "scripts" / "data" / "descriptions-fr.json"
    descriptions = json.loads(desc_path.read_text(encoding="utf-8")) if desc_path.exists() else {}

    def note_of(code: str) -> str:
        ann = annotations.get(code, [])
        return f"Annotation Unicode : {' ; '.join(ann)}" if ann else ""

    # 1) Fiches rédigées à la main (signes courants)
    seen = set()
    signs = []
    for code, translit, kinds, desc in SIGNS:
        assert code not in seen, f"doublon : {code}"
        seen.add(code)
        assert code in table, f"code absent d'Unicode : {code}"
        assert category_of(code) in CATEGORIES
        sign = {
            "gardiner": code,
            "unicode": table[code],
            "translit": translit,
            "kind": kinds,
            "descriptionFr": desc,
            "category": category_of(code),
            "verified": False,
            "common": True,
        }
        if note_of(code):
            sign["notes"] = note_of(code)
        signs.append(sign)

    # 2) Tous les autres signes Unicode, complétés automatiquement
    missing_desc = []
    for code, ch in table.items():
        if code in seen:
            continue
        kinds, values = parse_annotation(annotations.get(code, []))
        ann = annotations.get(code, [])
        if not kinds:
            # « version miroir de 1305C » : on reprend le type du signe d'origine.
            ref = next((re.search(r"([0-9A-F]{5})", a) for a in ann if "mirrored" in a or "variant" in a), None)
            if ref and chr(int(ref.group(1), 16)) in by_char:
                kinds, values = parse_annotation(annotations.get(by_char[chr(int(ref.group(1), 16))], []))
        if not kinds:
            kinds = ["ideogram"]  # type non précisé par Unicode (chiffres, signes de cartouche…)
        desc = descriptions.get(code, "")
        if not desc:
            missing_desc.append(code)
        sign = {
            "gardiner": code,
            "unicode": ch,
            "translit": values,
            "kind": kinds,
            "descriptionFr": desc,
            "category": category_of(code),
            "verified": False,
        }
        if note_of(code):
            sign["notes"] = note_of(code)
        signs.append(sign)

    order = {c: i for i, c in enumerate(CATEGORIES)}

    def sort_key(s):
        m = re.fullmatch(r"(Aa|[A-Z])(\d+)([A-Z]*)", s["gardiner"])
        return (order[m.group(1)], int(m.group(2)), m.group(3))

    signs.sort(key=sort_key)
    seed = {
        "avertissement": (
            "Données de départ INDICATIVES. Les signes courants ont une fiche rédigée à la main ; "
            "les autres sont complétés automatiquement : valeurs et types d'après les annotations "
            "officielles Unicode, descriptions françaises rédigées sans relecture par un spécialiste "
            "(« (?) » = apparence incertaine). Tout est à vérifier avec la liste de Gardiner "
            "(Egyptian Grammar, 3e éd., 1957)."
        ),
        "signs": signs,
    }
    (DATA / "signs.seed.json").write_text(json.dumps(seed, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        f"{len(table)} signes Unicode de la liste de Gardiner ; bibliothèque : {len(signs)} signes "
        f"({len(SIGNS)} fiches rédigées, {len(signs) - len(SIGNS)} complétées automatiquement)"
    )
    if missing_desc:
        print(f"⚠ {len(missing_desc)} signes sans description française : {' '.join(missing_desc[:20])}…")


if __name__ == "__main__":
    main()
