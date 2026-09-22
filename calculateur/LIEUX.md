# La base des lieux du calculateur

`lieux.sqlite` se reconstruit à partir de sources ouvertes, téléchargées dans `lieux-sources/` (non versionné) :

```sh
mkdir -p lieux-sources && cd lieux-sources
curl -o communes.json "https://geo.api.gouv.fr/communes?type=commune-actuelle,arrondissement-municipal&fields=nom,code,codeDepartement,centre,population,type&format=json"
curl -o departements.json "https://geo.api.gouv.fr/departements?fields=nom,code"
curl -O https://download.geonames.org/export/dump/FR.zip && unzip FR.zip FR.txt
curl -O https://download.geonames.org/export/dump/cities1000.zip && unzip cities1000.zip
curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
curl -O https://download.geonames.org/export/dump/alternateNamesV2.zip
unzip -p alternateNamesV2.zip alternateNamesV2.txt | awk -F'\t' '$3=="fr" && $8!="1" && $7!="1"' > noms-fr.txt
cd .. && python3 construire_lieux.py lieux-sources/ lieux.sqlite
```

Les noms de pays en français viennent du paquet `iso-codes` (Debian/Ubuntu).

**Licences des données** : communes de France, © geo.api.gouv.fr, Licence Ouverte Etalab 2.0 ; lieux et villes du monde,
© GeoNames (geonames.org), CC BY 4.0. Le fuseau de chaque lieu est un nom de la base tz (« Europe/Paris ») : c'est lui qui
porte l'histoire des heures légales, heure d'été comprise.
