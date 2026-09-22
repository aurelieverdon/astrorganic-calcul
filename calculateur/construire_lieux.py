#!/usr/bin/env python3
# Calculateur de carte du ciel d'astrOrganic — Copyright (C) 2026 Aurélie Verdon — AGPL-3.0 ou ultérieure (voir LICENSE).
"""Construit lieux.sqlite, la base des lieux de naissance du calculateur (recherche par nom, coordonnées, fuseau).

Sources, toutes ouvertes :
  - communes de France (geo.api.gouv.fr, Licence Ouverte Etalab 2.0) : communes actuelles et arrondissements ;
  - lieux habités de France (GeoNames FR.txt, CC BY 4.0) : anciennes communes fusionnées, villages ;
  - villes du monde de plus de 1 000 habitants (GeoNames cities1000.txt, CC BY 4.0), avec leur fuseau ;
  - leurs noms français (GeoNames alternateNamesV2, filtré sur « fr » dans noms-fr.txt) : Genève, Londres, Moscou.
Téléchargement des sources : voir LIEUX.md.
Le fuseau porte l'histoire des heures légales (heure d'été, changements d'heure) : c'est lui, pas un décalage
fixe, que le calcul utilise.

    python3 construire_lieux.py lieux-sources/ lieux.sqlite
"""
import csv, gettext, json, math, re, sqlite3, sys, unicodedata
from pathlib import Path

csv.field_size_limit(10 ** 7)
SRC, SORTIE = Path(sys.argv[1]), Path(sys.argv[2])

# Outre-mer : le fuseau suit le département ou la collectivité.
FUSEAUX_OM = {"971": "America/Guadeloupe", "972": "America/Martinique", "973": "America/Cayenne",
              "974": "Indian/Reunion", "976": "Indian/Mayotte", "975": "America/Miquelon",
              "977": "America/St_Barthelemy", "978": "America/Marigot", "984": "Indian/Kerguelen",
              "986": "Pacific/Wallis", "987": "Pacific/Tahiti", "988": "Pacific/Noumea", "989": "Pacific/Tahiti"}
NOMS_OM = {"975": "Saint-Pierre-et-Miquelon", "977": "Saint-Barthélemy", "978": "Saint-Martin",
           "984": "Terres australes et antarctiques françaises", "986": "Wallis-et-Futuna",
           "987": "Polynésie française", "988": "Nouvelle-Calédonie", "989": "Île de Clipperton"}
# Codes pays GeoNames des territoires déjà couverts par les communes officielles.
DEJA_COUVERTS = {"FR", "GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF", "WF", "PF", "NC"}


def norme(t):
    t = unicodedata.normalize("NFD", t.lower().replace("œ", "oe").replace("æ", "ae"))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    return re.sub(r"\b(st|ste)\b", lambda m: "saint" if m.group(1) == "st" else "sainte", t)


def latin(t):
    return all(ord(c) < 0x250 for c in t)


def distance_km(a, b):
    return 111 * math.hypot(a[0] - b[0], (a[1] - b[1]) * math.cos(math.radians(a[0])))


def main():
    iso = gettext.translation("iso_3166-1", "/usr/share/locale", languages=["fr"])
    pays = {x["alpha_2"]: iso.gettext(x["name"]) for x in
            json.load(open("/usr/share/iso-codes/json/iso_3166-1.json"))["3166-1"]}
    pays |= {"AX": "Îles Åland", "BO": "Bolivie", "CC": "Îles Cocos", "CX": "Île Christmas", "FK": "Îles Malouines",
             "FM": "Micronésie", "IR": "Iran", "KR": "Corée du Sud", "KP": "Corée du Nord", "LA": "Laos",
             "MD": "Moldavie", "PS": "Palestine", "RU": "Russie", "SB": "Îles Salomon", "SY": "Syrie", "TW": "Taïwan",
             "TZ": "Tanzanie", "VA": "Vatican", "VE": "Venezuela", "VI": "Îles Vierges des États-Unis",
             "SX": "Saint-Martin (partie néerlandaise)", "CZ": "Tchéquie"}
    admin1 = {}
    for l in open(SRC / "admin1CodesASCII.txt", encoding="utf-8"):
        code, nom = l.split("\t")[:2]
        admin1[code] = nom
    depts = {d["code"]: d["nom"] for d in json.load(open(SRC / "departements.json"))} | NOMS_OM

    lignes = []            # (nom, norme, contexte, lat, lon, fuseau, population)
    officielles = {}       # (norme, département) -> [(lat, lon)]
    for c in json.load(open(SRC / "communes.json")):
        lon, lat = c["centre"]["coordinates"]
        dep = c["codeDepartement"]
        fuseau = FUSEAUX_OM.get(dep, "Europe/Paris")
        contexte = f"{depts.get(dep, dep)} ({dep})" + ("" if dep in FUSEAUX_OM else ", France")
        lignes.append((c["nom"], norme(c["nom"]), contexte, lat, lon, fuseau, c.get("population") or 0))
        officielles.setdefault((norme(c["nom"]), dep), []).append((lat, lon))

    anciens = 0
    for r in csv.reader(open(SRC / "FR.txt", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE):
        if r[6] != "P" or r[7] in ("PPLX", "PPLQ", "PPLW"):
            continue      # sections de ville, lieux abandonnés ou détruits : pas des lieux de naissance
        dep = r[11] if r[11] else None
        if not dep:
            continue
        lat, lon, nom = float(r[4]), float(r[5]), r[1]
        if any(distance_km((lat, lon), o) < 5 for o in officielles.get((norme(nom), dep), [])):
            continue      # déjà là, sous son nom officiel
        lignes.append((nom, norme(nom), f"{depts.get(dep, dep)} ({dep}), France", lat, lon, r[17] or "Europe/Paris",
                       int(r[14] or 0)))
        anciens += 1

    francais = {}                                   # geonameid -> nom français (le « préféré » d'abord)
    for l in open(SRC / "noms-fr.txt", encoding="utf-8"):
        c = l.rstrip("\n").split("\t")
        if c[4] == "1" or c[1] not in francais:
            francais[c[1]] = c[3]

    alternatifs = []
    monde = 0
    for r in csv.reader(open(SRC / "cities1000.txt", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE):
        if r[8] in DEJA_COUVERTS or not r[17]:
            continue
        region = admin1.get(f"{r[8]}.{r[10]}", "")
        nom = francais.get(r[0], r[1])
        if norme(region) in (norme(r[1]), norme(nom)):
            region = ""                         # « Moscou, Moscow, Russie » : la région répète le nom de la ville
        contexte = ", ".join(x for x in (region, pays.get(r[8], r[8])) if x and x != nom)
        lignes.append((nom, norme(nom), contexte, float(r[4]), float(r[5]), r[17], int(r[14] or 0)))
        rang = len(lignes)
        vus = {norme(nom): None}                  # norme -> forme retenue pour la recherche
        if norme(r[1]) not in vus:
            vus[norme(r[1])] = r[1]               # le nom d'origine (« Geneva ») reste cherchable
        for alt in r[3].split(","):
            n = norme(alt)
            if not (alt and latin(alt) and n):
                continue
            if n in vus:
                continue
            # les grandes villes gardent tous leurs noms (« Londres », « Genève ») ; les petites, 25 au plus
            if len(vus) < 25 or int(r[14] or 0) >= 50000:
                vus[n] = alt
        alternatifs += [(alt, n, rang) for n, alt in vus.items() if alt is not None]
        monde += 1

    if SORTIE.exists():
        SORTIE.unlink()
    db = sqlite3.connect(SORTIE)
    db.executescript("""
        CREATE TABLE lieux (id INTEGER PRIMARY KEY, nom TEXT, norme TEXT, contexte TEXT,
                            lat REAL, lon REAL, fuseau TEXT, population INTEGER);
        CREATE TABLE autres_noms (nom TEXT, norme TEXT, lieu INTEGER);
    """)
    db.executemany("INSERT INTO lieux (nom, norme, contexte, lat, lon, fuseau, population) VALUES (?,?,?,?,?,?,?)",
                   lignes)
    db.executemany("INSERT INTO autres_noms VALUES (?,?,?)", alternatifs)
    db.executescript("""
        CREATE INDEX i_norme ON lieux (norme);
        CREATE INDEX i_autres ON autres_noms (norme);
        CREATE TABLE sources (texte TEXT);
    """)
    db.execute("INSERT INTO sources VALUES (?)", ("Communes : geo.api.gouv.fr (Licence Ouverte Etalab 2.0). "
               "Lieux habités et villes du monde : GeoNames (CC BY 4.0), geonames.org.",))
    db.commit()
    db.execute("VACUUM")
    print(f"{len(lignes)} lieux ({len(lignes) - anciens - monde} communes officielles, {anciens} autres lieux de France, "
          f"{monde} villes du monde), {len(alternatifs)} autres noms → {SORTIE} ({SORTIE.stat().st_size // 1024 // 1024} Mo)")


if __name__ == "__main__":
    main()
