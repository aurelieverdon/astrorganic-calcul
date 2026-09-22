<?php
// Calculateur d'astrOrganic — AGPL-3.0 ou ultérieure. Reçoit date, heure, lieu en JSON ; renvoie la carte calculée.
require dirname(__DIR__) . '/serveur/calcul.php';
calcul_repondre(calcul_carte($_SERVER['REQUEST_METHOD'] ?? '', (string) file_get_contents('php://input', false, null, 0, 2001)));
