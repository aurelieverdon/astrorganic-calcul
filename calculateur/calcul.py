#!/usr/bin/env python3
# Calculateur de carte du ciel d'astrOrganic — https://astrorganic.fr/calcul-theme-astral/
# Copyright (C) 2026 Aurélie Verdon (astrOrganic)
#
# Ce programme est un logiciel libre : vous pouvez le redistribuer et/ou le modifier selon les termes
# de la GNU Affero General Public License, version 3 ou ultérieure, publiée par la Free Software
# Foundation. Il utilise la Swiss Ephemeris, distribuée sous la même licence (AGPL).
# Ce programme est distribué SANS AUCUNE GARANTIE. Voir le fichier LICENSE.
"""Calcule une carte du ciel. Rien d'autre : aucune interprétation.

Lit sur l'entrée standard un JSON :
    {"date": "AAAA-MM-JJ", "heure": "HH:MM" ou null (heure inconnue),
     "latitude": 45.76, "longitude": 4.84, "fuseau": "Europe/Paris"}
et écrit sur la sortie standard la carte en JSON (positions, maisons, aspects), ou {"erreur": "..."}.

Conventions (les mêmes que les thèmes astraux d'astrOrganic) :
  - maisons égales, comptées de 30° en 30° depuis l'Ascendant ;
  - nœuds lunaires moyens ; Lune Noire moyenne (apogée moyen de la Lune) ;
  - heure civile convertie en temps universel avec l'heure d'été de l'époque (base tz) ;
  - aspects majeurs, orbes : conjonction et opposition 8° (10° avec le Soleil ou la Lune),
    carré et trigone 7° (8°), sextile 5° (6°) ; entre deux planètes lentes de génération
    (Uranus, Neptune, Pluton), 3°.
Heure inconnue : la carte est calculée à midi, sans Ascendant, sans Milieu du Ciel, sans maisons,
et la Lune est donnée avec sa course de la journée (elle avance d'environ 13° par jour).
Rien n'est enregistré : les données entrent, la carte sort.
"""
import json, os, sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import swisseph as swe

EPHEMERIDES = os.environ.get("CALCUL_EPHEMERIDES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ephemerides"))
FICHIERS = ("sepl_18.se1", "semo_18.se1", "seas_18.se1")   # 1800-2399 : planètes, Lune, Chiron
ANNEE_MIN, ANNEE_MAX = 1800, 2399

SIGNES = ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
          "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"]
CORPS = [("Soleil", swe.SUN), ("Lune", swe.MOON), ("Mercure", swe.MERCURY), ("Vénus", swe.VENUS),
         ("Mars", swe.MARS), ("Jupiter", swe.JUPITER), ("Saturne", swe.SATURN), ("Uranus", swe.URANUS),
         ("Neptune", swe.NEPTUNE), ("Pluton", swe.PLUTO), ("Chiron", swe.CHIRON),
         ("Lune Noire", swe.MEAN_APOG), ("Nœud Nord", swe.MEAN_NODE)]
LUMINAIRES = {"Soleil", "Lune"}
GENERATION = {"Uranus", "Neptune", "Pluton"}
ASPECTS = [("conjonction", 0, 8, 10), ("sextile", 60, 5, 6), ("carré", 90, 7, 8),
           ("trigone", 120, 7, 8), ("opposition", 180, 8, 10)]


class Refus(Exception):
    pass


def signe_de(lon):
    return SIGNES[int(lon // 30) % 12]


def degre_lisible(lon):
    """12°34' — arrondi à la minute d'arc, sur la position entière (la retenue passe : jamais « 25°60' »).
    À moins d'une demi-minute de la fin d'un signe, on écrit 29°59' plutôt que 0°00' du signe suivant :
    le signe se calcule à part, sur la longitude vraie, et l'affichage ne doit pas le contredire.
    C'est la règle des thèmes astraux d'astrOrganic."""
    minutes = int(round((lon % 30) * 60))
    d, m = divmod(minutes, 60)
    if d >= 30:
        d, m = 29, 59
    return f"{d}°{m:02d}'"


def position(lon, cuspides=None, vitesse=None):
    p = {"longitude": round(lon, 4), "signe": signe_de(lon), "degre": degre_lisible(lon)}
    if cuspides:
        p["maison"] = int(((lon - cuspides[0]) % 360) // 30) + 1      # maisons égales
    if vitesse is not None:
        p["retrograde"] = vitesse < 0
    return p


def lire(entree):
    try:
        a, mo, j = (int(x) for x in str(entree["date"]).split("-"))
        lat, lon = float(entree["latitude"]), float(entree["longitude"])
        zone = ZoneInfo(str(entree["fuseau"]))
    except (KeyError, ValueError, TypeError, ZoneInfoNotFoundError):
        raise Refus("Données incomplètes : date, lieu et fuseau sont nécessaires.")
    if not ANNEE_MIN <= a <= ANNEE_MAX:
        raise Refus(f"Le calcul couvre les années {ANNEE_MIN} à {ANNEE_MAX}.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise Refus("Coordonnées du lieu hors limites.")
    try:
        datetime(a, mo, j)
    except ValueError:
        raise Refus("Cette date n'existe pas.")
    heure = entree.get("heure")
    if heure:
        try:
            h, mi = (int(x) for x in str(heure).split(":"))
            locale = datetime(a, mo, j, h, mi, tzinfo=zone)
        except ValueError:
            raise Refus("Heure illisible : elle s'écrit HH:MM.")
    else:
        try:
            locale = datetime(a, mo, j, 12, 0, tzinfo=zone)
        except ValueError:
            raise Refus("Date impossible.")
    return locale, lat, lon, bool(heure)


def jour_julien(utc):
    return swe.julday(utc.year, utc.month, utc.day, utc.hour + utc.minute / 60 + utc.second / 3600)


def longitude(jd, corps):
    res, drapeau = swe.calc_ut(jd, corps, swe.FLG_SWIEPH | swe.FLG_SPEED)
    # Sans ses fichiers, la Swiss Ephemeris ne lève pas d'erreur : elle retombe en silence sur un
    # modèle moins précis (Moshier). On refuse plutôt que d'afficher une carte hors convention.
    if not drapeau & swe.FLG_SWIEPH:
        raise Refus("Éphémérides indisponibles : calcul refusé plutôt qu'approximatif.")
    return res[0], res[3]


def carte(entree):
    for f in FICHIERS:
        if not os.path.exists(os.path.join(EPHEMERIDES, f)):
            raise Refus("Éphémérides manquantes sur le serveur : calcul refusé.")
    swe.set_ephe_path(EPHEMERIDES)
    locale, lat, lon_lieu, heure_connue = lire(entree)
    utc = locale.astimezone(ZoneInfo("UTC"))
    jd = jour_julien(utc)

    cuspides = None
    angles = {}
    if heure_connue:
        c, a = swe.houses(jd, lat, lon_lieu, b"A")
        cuspides = list(c[:12])
        angles = {"Ascendant": a[0], "Milieu du Ciel": a[1]}

    points = {}
    for nom, corps in CORPS:
        lon, vitesse = longitude(jd, corps)
        points[nom] = position(lon, cuspides, vitesse)
    nn = points["Nœud Nord"]["longitude"]
    points["Nœud Sud"] = position((nn + 180) % 360, cuspides, -1)   # toujours en face du Nord
    for nom, lon in angles.items():
        points[nom] = position(lon)   # les angles n'ont pas de maison : ils bornent les maisons

    course_lune = None
    if not heure_connue:
        debut = datetime(locale.year, locale.month, locale.day, 0, 0, tzinfo=locale.tzinfo)
        fin = debut + timedelta(hours=23, minutes=59)
        l0 = longitude(jour_julien(debut.astimezone(ZoneInfo("UTC"))), swe.MOON)[0]
        l1 = longitude(jour_julien(fin.astimezone(ZoneInfo("UTC"))), swe.MOON)[0]
        course_lune = {"de": position(l0), "a": position(l1), "change_de_signe": signe_de(l0) != signe_de(l1)}

    aspects = []
    noms = [n for n in points if n != "Nœud Sud"]
    for i, a in enumerate(noms):
        for b in noms[i + 1:]:
            if not heure_connue and "Lune" in (a, b):
                continue    # la Lune bouge trop dans la journée pour dater un aspect sans heure
            e = abs(points[a]["longitude"] - points[b]["longitude"]) % 360
            e = min(e, 360 - e)
            for nom, angle, orbe, orbe_lum in ASPECTS:
                large = 3 if a in GENERATION and b in GENERATION else (orbe_lum if LUMINAIRES & {a, b} else orbe)
                if abs(e - angle) <= large:
                    aspects.append({"de": a, "a": b, "aspect": nom, "ecart": round(abs(e - angle), 2)})
                    break
    aspects.sort(key=lambda x: x["ecart"])

    decalage = locale.utcoffset().total_seconds() / 3600
    return {
        "naissance": {"date": locale.strftime("%Y-%m-%d"), "heure": locale.strftime("%H:%M") if heure_connue else None,
                      "latitude": lat, "longitude": lon_lieu, "fuseau": str(entree["fuseau"]),
                      "decalage": f"UTC{decalage:+g}", "heure_utc": utc.strftime("%Y-%m-%d %H:%M")},
        "conventions": {"maisons": "égales", "noeuds": "moyens", "lune_noire": "moyenne",
                        "ephemerides": "Swiss Ephemeris, fichiers 1800-2399"},
        "heure_connue": heure_connue,
        "points": points,
        "maisons": [position(c) for c in cuspides] if cuspides else None,
        "aspects": aspects,
        "course_lune": course_lune,
    }


if __name__ == "__main__":
    try:
        entree = json.loads(sys.stdin.read() or "{}")
        sortie = carte(entree)
    except Refus as r:
        sortie = {"erreur": str(r)}
    except Exception:
        sortie = {"erreur": "Calcul impossible avec ces données."}
    print(json.dumps(sortie, ensure_ascii=False))
