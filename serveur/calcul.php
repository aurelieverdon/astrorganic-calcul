<?php
// Calculateur de carte du ciel d'astrOrganic — Copyright (C) 2026 Aurélie Verdon
// Logiciel libre sous GNU Affero General Public License, version 3 ou ultérieure (voir LICENSE du dépôt public).
//
// Bibliothèque des deux points d'entrée publics du calculateur (calcul-theme-astral/lieux.php et calculer.php).
// Rangée sous serveur/, jamais servie par le web (serveur/.htaccess). Rien n'est enregistré : ni la date, ni l'heure,
// ni le lieu. Seule trace : un compteur anonyme par adresse IP hachée (sel du jour), pour freiner les abus, effacé
// au bout de deux heures.

if (PHP_SAPI !== 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    http_response_code(404);
    exit;
}

define('CALCUL_RACINE', dirname(__DIR__, 2) . '/calcul');    // hors du dossier web : à côté du dossier du site
const CALCUL_PYTHON = CALCUL_RACINE . '/venv/bin/python';
const CALCUL_SCRIPT = CALCUL_RACINE . '/app/calcul.py';
const CALCUL_LIEUX = CALCUL_RACINE . '/lieux.sqlite';
const CALCUL_LIMITES = CALCUL_RACINE . '/limites';
const CALCUL_PAR_HEURE = 60;                                  // calculs par adresse et par heure
const LIEUX_PAR_HEURE = 900;                                  // recherches de lieu (une par lettre tapée)
const CALCUL_DELAI = 8;                                       // secondes

/** La même normalisation que construire_lieux.py : minuscules, sans accents, « st » → « saint ». */
function calcul_norme(string $t): string
{
    $t = mb_strtolower($t, 'UTF-8');
    $t = str_replace(['œ', 'æ'], ['oe', 'ae'], $t);
    $t = Normalizer::normalize($t, Normalizer::FORM_D);
    $t = preg_replace('/\p{Mn}+/u', '', $t);
    $t = trim(preg_replace('/[^a-z0-9]+/', ' ', $t));
    return preg_replace_callback('/\b(st|ste)\b/', fn($m) => $m[1] === 'st' ? 'saint' : 'sainte', $t);
}

/** Freine les abus sans rien garder de la personne : un compteur par IP hachée, sel renouvelé chaque jour. */
function calcul_limite_ok(string $quoi, int $max): bool
{
    if (!is_dir(CALCUL_LIMITES) && !@mkdir(CALCUL_LIMITES, 0700, true)) {
        return true;
    }
    $sel = CALCUL_LIMITES . '/sel-' . gmdate('Ymd');
    if (!is_file($sel)) {
        foreach (glob(CALCUL_LIMITES . '/sel-*') ?: [] as $vieux) { @unlink($vieux); }
        @file_put_contents($sel, bin2hex(random_bytes(16)));
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $cle = hash('sha256', (string) @file_get_contents($sel) . $ip . $quoi);
    $f = CALCUL_LIMITES . '/' . $quoi . '-' . gmdate('YmdH') . '-' . substr($cle, 0, 24);
    $n = (int) @file_get_contents($f) + 1;
    @file_put_contents($f, (string) $n);
    @chmod($f, 0600);
    if (random_int(1, 50) === 1) {                            // ménage : ce qui a plus de deux heures
        foreach (glob(CALCUL_LIMITES . '/*-*-*') ?: [] as $g) {
            if (filemtime($g) < time() - 7200) { @unlink($g); }
        }
    }
    return $n <= $max;
}

/** Recherche de lieux : jusqu'à 8 propositions, correspondance exacte d'abord, puis les plus peuplés. */
function calcul_lieux(string $q): array
{
    $n = calcul_norme(mb_substr($q, 0, 80));
    if (mb_strlen($n) < 3) {
        return [200, ['lieux' => []]];
    }
    if (!calcul_limite_ok('lieux', LIEUX_PAR_HEURE)) {
        return [429, ['erreur' => 'Trop de recherches d’un coup : réessaie dans un moment.']];
    }
    try {
        $db = new PDO('sqlite:' . CALCUL_LIEUX, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } catch (Throwable $e) {
        error_log('calcul : base des lieux illisible');
        return [500, ['erreur' => 'Recherche de lieu indisponible.']];
    }
    $sql = "SELECT id, nom, tape, contexte, lat, lon, fuseau, population, exact FROM (
              SELECT id, nom, NULL AS tape, contexte, lat, lon, fuseau, population, norme = :q AS exact
                FROM lieux WHERE norme >= :q AND norme < :q || '~'
              UNION ALL
              SELECT l.id, l.nom, a.nom, l.contexte, l.lat, l.lon, l.fuseau, l.population, a.norme = :q
                FROM autres_noms a JOIN lieux l ON l.id = a.lieu WHERE a.norme >= :q AND a.norme < :q || '~'
            ) ORDER BY exact DESC, population DESC LIMIT 60";
    $st = $db->prepare($sql);
    $st->execute([':q' => $n]);
    $vus = [];
    foreach ($st as $r) {
        $id = (int) $r['id'];
        $tape = $r['tape'];
        if (isset($vus[$id])) {
            // un même lieu trouvé par plusieurs noms : garder le nom accentué (« Genève » plutôt que « Geneve »)
            if ($tape !== null && $vus[$id]['tape'] !== null && preg_match('/[^\x00-\x7F]/', $tape)
                && !preg_match('/[^\x00-\x7F]/', $vus[$id]['tape']) && calcul_norme($tape) === calcul_norme($vus[$id]['tape'])) {
                $vus[$id]['tape'] = $tape;
            }
            continue;
        }
        if (count($vus) >= 8) {
            continue;
        }
        $vus[$id] = ['nom' => $r['nom'], 'tape' => $tape, 'contexte' => $r['contexte'],
                     'lat' => round((float) $r['lat'], 5), 'lon' => round((float) $r['lon'], 5), 'fuseau' => $r['fuseau']];
    }
    $lieux = [];
    foreach ($vus as $v) {
        $affiche = $v['tape'] !== null && calcul_norme($v['tape']) !== calcul_norme($v['nom'])
            ? $v['tape'] . ' (' . $v['nom'] . ')' : $v['nom'];
        $lieux[] = ['nom' => $affiche, 'contexte' => $v['contexte'], 'lat' => $v['lat'], 'lon' => $v['lon'],
                    'fuseau' => $v['fuseau']];
    }
    return [200, ['lieux' => $lieux]];
}

/** Valide la demande, puis confie le calcul à calcul.py (Swiss Ephemeris). Renvoie [code HTTP, réponse]. */
function calcul_carte(string $methode, string $corps): array
{
    if ($methode !== 'POST') {
        return [405, ['erreur' => 'Méthode non permise.']];
    }
    if (strlen($corps) > 2000) {
        return [413, ['erreur' => 'Demande trop longue.']];
    }
    $d = json_decode($corps, true);
    if (!is_array($d)) {
        return [400, ['erreur' => 'Demande illisible.']];
    }
    $date = (string) ($d['date'] ?? '');
    $heure = $d['heure'] ?? null;
    $fuseau = (string) ($d['fuseau'] ?? '');
    $lat = $d['latitude'] ?? null;
    $lon = $d['longitude'] ?? null;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
        || ($heure !== null && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) $heure))
        || !preg_match('#^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$#', $fuseau)
        || !is_numeric($lat) || !is_numeric($lon)) {
        return [400, ['erreur' => 'Il manque la date, le lieu, ou l’heure est mal écrite.']];
    }
    if (!calcul_limite_ok('calcul', CALCUL_PAR_HEURE)) {
        return [429, ['erreur' => 'Beaucoup de calculs d’un coup : réessaie dans un moment.']];
    }
    $entree = json_encode(['date' => $date, 'heure' => $heure, 'fuseau' => $fuseau,
                           'latitude' => (float) $lat, 'longitude' => (float) $lon]);
    $p = proc_open([CALCUL_PYTHON, CALCUL_SCRIPT], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $tubes);
    if (!is_resource($p)) {
        error_log('calcul : lancement impossible');
        return [500, ['erreur' => 'Le calcul est indisponible pour le moment.']];
    }
    fwrite($tubes[0], $entree);
    fclose($tubes[0]);
    stream_set_blocking($tubes[1], false);
    $sortie = '';
    $fin = microtime(true) + CALCUL_DELAI;
    while (microtime(true) < $fin) {
        $sortie .= (string) stream_get_contents($tubes[1]);
        if (!proc_get_status($p)['running']) {
            $sortie .= (string) stream_get_contents($tubes[1]);
            break;
        }
        usleep(10000);
    }
    $erreurs = stream_get_contents($tubes[2]);
    fclose($tubes[1]);
    fclose($tubes[2]);
    if (proc_get_status($p)['running']) {
        proc_terminate($p);
        error_log('calcul : délai dépassé');
        return [504, ['erreur' => 'Le calcul a pris trop de temps.']];
    }
    proc_close($p);
    $r = json_decode($sortie, true);
    if (!is_array($r)) {
        error_log('calcul : réponse illisible ' . substr((string) $erreurs, 0, 300));
        return [500, ['erreur' => 'Le calcul a échoué.']];
    }
    return [isset($r['erreur']) ? 422 : 200, $r];
}

/** Envoie la réponse JSON, sans cache ni indexation. */
function calcul_repondre(array $resultat): void
{
    [$code, $reponse] = $resultat;
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo json_encode($reponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
