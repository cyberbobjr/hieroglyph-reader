#!/usr/bin/env python3
"""
Extrait les annotations officielles des hiéroglyphes depuis la liste des noms
Unicode (NamesList), version 17.0.0, distribuée dans le paquet npm « ucd-full ».

Chaque signe y est annoté par sa fonction (logogram, classifier = déterminatif,
phonemogram) et sa valeur, ex. « E017 : phonemogram : sꜣb ».

Utilisation (une seule fois, le résultat est versionné) :
    npm pack ucd-full@17.0.0 && tar xzf ucd-full-17.0.0.tgz
    python3 scripts/extract-unicode-annotations.py package/NamesList.json

Source : Unicode® Character Database, © Unicode, Inc., licence Unicode v3
(https://www.unicode.org/license.txt).
"""
import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data" / "unicode-annotations.json"


def main(path: str):
    entries = json.loads(Path(path).read_text(encoding="utf-8"))["NamesList"]
    out = {}
    for e in entries:
        name = e.get("name", "") if isinstance(e, dict) else ""
        m = re.fullmatch(r"EGYPTIAN HIEROGLYPH (AA|[A-Z])(\d{3})([A-Z]*)", name)
        if not m:
            continue
        cat, num, suffix = m.groups()
        code = f"{'Aa' if cat == 'AA' else cat}{int(num)}{suffix}"
        out[code] = e.get("comments", [])
    payload = {
        "source": "Unicode 17.0.0 NamesList (paquet npm ucd-full@17.0.0), licence Unicode v3",
        "annotations": out,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(out)} signes, {sum(1 for v in out.values() if v)} annotés → {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
