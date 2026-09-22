# Le calculateur de carte du ciel d'astrOrganic

Le code complet de la page [astrorganic.fr/calcul-theme-astral/](https://astrorganic.fr/calcul-theme-astral/) :
tu donnes une date, une heure et un lieu de naissance, il rend la carte du ciel. **Il calcule, il n'interprète pas.**
Au survol, chaque élément dit ce qu'il est en général, selon la tradition, et renvoie au carnet d'astrOrganic.

C'est la méthode d'astrOrganic, *d'abord le calcul, ensuite la lecture*, et ce dépôt en est la partie vérifiable :
tu peux lire comment chaque position est obtenue, refaire le calcul, et nous signaler une erreur.

## Ce qu'il y a dedans

| Fichier | Rôle |
|---|---|
| `calculateur/calcul.py` | Le calcul : heure légale → temps universel (base tz, heure d'été de l'époque), positions (Swiss Ephemeris), maisons égales, aspects. Entrée et sortie en JSON. |
| `calculateur/construire_lieux.py` | Construit la base des lieux (communes de France, villes du monde, fuseaux). Voir `LIEUX.md`. |
| `serveur/calcul.php` | Le serveur : recherche de lieu, validation, appel de `calcul.py`, limite anti-abus anonyme. |
| `calcul-theme-astral/` | La page : formulaire, roue en SVG, survol, tableau, PDF fabriqué dans le navigateur. |

## Les conventions

Les mêmes que les thèmes astraux d'astrOrganic, qui sont calculés avec la même bibliothèque et les mêmes réglages :
maisons **égales** depuis l'Ascendant ; nœuds lunaires **moyens** ; Lune Noire **moyenne** ; degrés arrondis à la minute
d'arc sans jamais franchir un signe ; aspects majeurs avec des orbes de 8° (conjonction, opposition), 7° (carré,
trigone), 5° (sextile), élargis de 2° ou 1° avec le Soleil ou la Lune, et resserrés à 3° entre Uranus, Neptune et Pluton.
Sans heure de naissance : calcul à midi, sans Ascendant ni maisons, et la course de la Lune dans la journée.

**Rien n'est enregistré.** Ni la date, ni l'heure, ni le lieu. Seul un compteur anonyme (adresse IP hachée avec un sel
renouvelé chaque jour) limite le nombre de calculs par heure ; il s'efface au bout de deux heures.

## Essayer en local

```sh
pip install pyswisseph==2.10.3.2 tzdata
# les fichiers d'éphémérides sepl_18.se1, semo_18.se1, seas_18.se1 (1800-2399) : https://github.com/aloistr/swisseph/tree/master/ephe
mkdir -p calculateur/ephemerides   # y déposer les trois fichiers
echo '{"date": "1986-03-12", "heure": "18:30", "latitude": 45.764, "longitude": 4.8357, "fuseau": "Europe/Paris"}' \
  | python3 calculateur/calcul.py
```

## Licence

Logiciel libre, sous **GNU Affero General Public License, version 3 ou ultérieure** (fichier `LICENSE`), comme la
[Swiss Ephemeris](https://www.astro.com/swisseph/) d'Astrodienst sur laquelle il repose. Si tu fais tourner une version
modifiée de ce calculateur sur un site, l'AGPL te demande d'en publier le code, toi aussi.

Composants tiers : Swiss Ephemeris (AGPL) ; jsPDF et svg2pdf.js (MIT, `calcul-theme-astral/lib/`) ; police Spectral
(SIL OFL) ; glyphes tirés de DejaVu Sans (licence libre Bitstream Vera / DejaVu) ; données de lieux : geo.api.gouv.fr
(Licence Ouverte Etalab 2.0) et GeoNames (CC BY 4.0).

© 2026 Aurélie Verdon — astrOrganic.
