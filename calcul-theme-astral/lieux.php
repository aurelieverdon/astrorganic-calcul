<?php
// Calculateur d'astrOrganic — AGPL-3.0 ou ultérieure. Recherche de lieu de naissance : ?q=lyo → jusqu'à 8 lieux.
require dirname(__DIR__) . '/serveur/calcul.php';
calcul_repondre(calcul_lieux((string) ($_GET['q'] ?? '')));
