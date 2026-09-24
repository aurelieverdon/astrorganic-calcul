/* =====================================================================
   CALCULATEUR DE CARTE DU CIEL — astrOrganic
   Copyright (C) 2026 Aurélie Verdon. Logiciel libre : GNU Affero General Public License, version 3 ou
   ultérieure. Code source complet : voir le lien « Le code source » en bas de la page.
   =====================================================================
   La page envoie date, heure et lieu à calculer.php, qui confie le calcul à la Swiss Ephemeris, puis dessine
   la carte. Rien n'est gardé : ni sur le serveur, ni dans ce navigateur. Le PDF se fabrique ici, dans le
   navigateur, avec jsPDF et svg2pdf (hébergés sur ce site, pas de service tiers).
   ===================================================================== */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ORDRE = ['Soleil', 'Lune', 'Mercure', 'Vénus', 'Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune', 'Pluton',
               'Chiron', 'Lune Noire', 'Nœud Nord', 'Nœud Sud'];
  var SIGNES = ['Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge', 'Balance', 'Scorpion', 'Sagittaire',
                'Capricorne', 'Verseau', 'Poissons'];
  var ELEMENT = { Feu: '#B4830C', Terre: '#6E6656', Air: '#3E6A80', Eau: '#28506A' };
  var ELEMENT_DE = ['Feu', 'Terre', 'Air', 'Eau'];
  var HARMONIE = { trigone: 1, sextile: 1 };

  // Le sextile manque dans la police : trois traits croisés, dessinés ici (même carré 1 × 1 que les autres).
  (function () {
    var d = '', e = 0.055;
    [0, 60, 120].forEach(function (a) {
      var r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), px = -s * e, py = c * e;
      d += 'M' + (-0.5 * c + px).toFixed(3) + ' ' + (-0.5 * s + py).toFixed(3) + 'L' + (0.5 * c + px).toFixed(3) + ' ' +
           (0.5 * s + py).toFixed(3) + 'L' + (0.5 * c - px).toFixed(3) + ' ' + (0.5 * s - py).toFixed(3) + 'L' +
           (-0.5 * c - px).toFixed(3) + ' ' + (-0.5 * s - py).toFixed(3) + 'Z';
    });
    GLYPHES.sextile = d;
  })();

  function $(id) { return document.getElementById(id); }
  function el(nom, attrs, parent) {
    var n = document.createElementNS(SVGNS, nom);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte != null) n.textContent = texte;
    return n;
  }
  function glyphe(nom, x, y, taille, parent, couleur) {
    return el('path', { d: GLYPHES[nom], transform: 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') scale(' + taille + ')',
                        fill: couleur || 'currentColor' }, parent);
  }
  function petitGlyphe(nom, classe) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '-0.6 -0.6 1.2 1.2');
    s.setAttribute('class', 'gl ' + (classe || ''));
    s.setAttribute('aria-hidden', 'true');
    el('path', { d: GLYPHES[nom], fill: 'currentColor' }, s);
    return s;
  }
  function elementDe(signe) { return ELEMENT_DE[SIGNES.indexOf(signe) % 4]; }

  /* ------------------------------------------------------------ formulaire : le lieu */
  var etat = { lieu: null, carte: null, demande: null };
  var champLieu = $('lieu'), liste = $('lieux'), choix = -1, minuteur = null;

  function afficherLieux(lieux) {
    liste.innerHTML = '';
    choix = -1;
    lieux.forEach(function (l, i) {
      var li = html('li');
      li.setAttribute('role', 'option');
      li.id = 'lieu-' + i;
      li.appendChild(html('span', 'nom', l.nom));
      li.appendChild(html('span', 'ctx', l.contexte));
      li.addEventListener('mousedown', function (ev) { ev.preventDefault(); choisir(l); });
      liste.appendChild(li);
    });
    liste.hidden = !lieux.length;
    champLieu.setAttribute('aria-expanded', lieux.length ? 'true' : 'false');
  }
  function choisir(l) {
    etat.lieu = l;
    champLieu.value = l.nom + (l.contexte ? ', ' + l.contexte : '');
    liste.hidden = true;
    champLieu.setAttribute('aria-expanded', 'false');
    $('lieu-choisi').textContent = 'Fuseau horaire : ' + l.fuseau + ' · ' + l.lat.toFixed(2) + ', ' + l.lon.toFixed(2);
  }
  champLieu.addEventListener('input', function () {
    etat.lieu = null;
    $('lieu-choisi').textContent = '';
    var q = champLieu.value.trim();
    clearTimeout(minuteur);
    if (q.length < 3) { afficherLieux([]); return; }
    minuteur = setTimeout(function () {
      fetch('lieux.php?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); })
        .then(function (d) { if (champLieu.value.trim() === q) afficherLieux(d.lieux || []); })
        .catch(function () { afficherLieux([]); });
    }, 180);
  });
  champLieu.addEventListener('keydown', function (ev) {
    var items = liste.querySelectorAll('li');
    if (liste.hidden || !items.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      choix = (choix + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (li, i) { li.classList.toggle('actif', i === choix); });
      champLieu.setAttribute('aria-activedescendant', 'lieu-' + choix);
    } else if (ev.key === 'Enter' && choix >= 0) {
      ev.preventDefault();
      items[choix].dispatchEvent(new MouseEvent('mousedown'));
    } else if (ev.key === 'Escape') {
      liste.hidden = true;
    }
  });
  champLieu.addEventListener('blur', function () { setTimeout(function () { liste.hidden = true; }, 150); });
  $('sans-heure').addEventListener('change', function () {
    $('heure').disabled = this.checked;
    if (this.checked) $('heure').value = '';
  });

  /* ------------------------------------------------------------ formulaire : l'envoi */
  $('formulaire').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('message');
    msg.textContent = '';
    var date = $('date').value, heure = $('sans-heure').checked ? null : $('heure').value;
    if (!date) { msg.textContent = 'Indique la date de naissance.'; $('date').focus(); return; }
    if (!heure && !$('sans-heure').checked) { msg.textContent = 'Indique l’heure de naissance, ou coche « je ne la connais pas ».'; $('heure').focus(); return; }
    if (!etat.lieu) { msg.textContent = 'Choisis le lieu de naissance dans la liste qui s’affiche quand tu tapes.'; champLieu.focus(); return; }
    var bouton = $('calculer');
    bouton.disabled = true;
    bouton.textContent = 'Calcul en cours…';
    etat.demande = { date: date, heure: heure, lieu: etat.lieu };
    fetch('calculer.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: date, heure: heure, latitude: etat.lieu.lat, longitude: etat.lieu.lon, fuseau: etat.lieu.fuseau })
    }).then(function (r) { return r.json(); }).then(function (c) {
      if (c.erreur) { msg.textContent = c.erreur; return; }
      etat.carte = c;
      afficher(c);
    }).catch(function () {
      msg.textContent = 'Le calcul n’a pas abouti. Vérifie ta connexion et réessaie.';
    }).then(function () {
      bouton.disabled = false;
      bouton.textContent = 'Calculer ma carte';
    });
  });

  /* ------------------------------------------------------------ mots */
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function dateLisible(iso) {
    var p = iso.split('-');
    return (+p[2] === 1 ? '1er' : +p[2]) + ' ' + MOIS[+p[1] - 1] + ' ' + p[0];
  }
  function heureLisible(h) { var p = h.split(':'); return +p[0] + ' h ' + p[1]; }
  function utcLisible(u) { var p = u.split(' '); return dateLisible(p[0]) + ' à ' + heureLisible(p[1]); }
  function position(p) { return p.degre + ' ' + p.signe; }
  function ecartLisible(e) { var d = Math.floor(e), m = Math.round((e - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '\''; }
  function sujetsDans(c, filtre) {
    return ORDRE.filter(function (n) { return c.points[n] && filtre(c.points[n]); });
  }

  /* ------------------------------------------------------------ la bulle */
  var bulle = $('bulle'), fermeture = null, calmeJusqua = 0;   // après l'affichage, la roue glisse sous un pointeur immobile : pas de bulle surprise
  function contenuPoint(c, nom) {
    var p = c.points[nom], t = TEXTES.points[nom];
    var lignes = [position(p) + (p.maison ? ', en Maison ' + CHIFFRES_ROMAINS[p.maison - 1] : '') + (p.retrograde && nom.indexOf('Nœud') < 0 && nom !== 'Lune Noire' ? ' · rétrograde' : '')];
    return { glyphe: nom === 'Ascendant' || nom === 'Milieu du Ciel' ? null : nom, titre: nom, fait: lignes[0], quoi: t.quoi, url: t.url, lien: t.titre,
             extra: p.retrograde && ['Nœud Nord', 'Nœud Sud', 'Lune Noire'].indexOf(nom) < 0 ? TEXTES.retrograde : null };
  }
  function contenuSigne(c, signe) {
    var dedans = sujetsDans(c, function (p) { return p.signe === signe; });
    return { glyphe: signe, titre: signe, fait: dedans.length ? 'Dans ta carte : ' + dedans.join(', ') : 'Aucun point de ta carte dans ce signe.',
             quoi: TEXTES.signes[signe] + ' Le signe dit comment une fonction s’exprime : c’est l’adverbe de la phrase.', url: BRIQUES.url, lien: BRIQUES.titre };
  }
  function contenuMaison(c, n) {
    var dedans = sujetsDans(c, function (p) { return p.maison === n; });
    var url = n === 7 ? CARNET + 'la-maison-vii/' : MAISONS_ART.url;
    return { glyphe: null, titre: 'Maison ' + CHIFFRES_ROMAINS[n - 1], fait: (dedans.length ? 'Dans ta carte : ' + dedans.join(', ') : 'Aucun point de ta carte dans cette maison.') + ' · commence à ' + position(c.maisons[n - 1]),
             quoi: 'Une maison est un terrain de vie. Dans la tradition, celle-ci est ' + TEXTES.maisons[n - 1] + '.', url: url, lien: n === 7 ? 'La Maison VII' : MAISONS_ART.titre };
  }
  function contenuAspect(a) {
    var t = TEXTES.aspects[a.aspect];
    return { glyphe: a.aspect, titre: a.de + ' – ' + a.a, fait: a.aspect.charAt(0).toUpperCase() + a.aspect.slice(1) + ' (' + t.angle + '), à ' + ecartLisible(a.ecart) + ' près',
             quoi: t.quoi + ' Un aspect dit avec quelle autre fonction une planète dialogue.', url: BRIQUES.url, lien: BRIQUES.titre };
  }
  function remplirBulle(k) {
    bulle.innerHTML = '';
    var tete = html('div', 'tete');
    if (k.glyphe) tete.appendChild(petitGlyphe(k.glyphe));
    tete.appendChild(html('strong', null, k.titre));
    bulle.appendChild(tete);
    bulle.appendChild(html('p', 'fait', k.fait));
    bulle.appendChild(html('p', 'quoi', k.quoi));
    if (k.extra) bulle.appendChild(html('p', 'quoi', k.extra.quoi));
    var a = html('a', 'lien', 'Lire dans le carnet : ' + k.lien + ' →');
    a.href = k.url;
    bulle.appendChild(a);
    var f = html('button', 'fermer', '×');
    f.type = 'button';
    f.setAttribute('aria-label', 'Fermer');
    f.addEventListener('click', cacherBulle);
    bulle.appendChild(f);
  }
  function montrerBulle(k, cible, epingle) {
    clearTimeout(fermeture);
    remplirBulle(k);
    bulle.hidden = false;
    bulle.classList.toggle('epinglee', !!epingle);
    var etroit = window.matchMedia('(max-width: 700px)').matches;
    if (etroit) { bulle.style.left = ''; bulle.style.top = ''; bulle.classList.add('en-bas'); return; }
    bulle.classList.remove('en-bas');
    var r = cible.getBoundingClientRect(), b = bulle.getBoundingClientRect();
    var x = r.right + 12, y = r.top + window.scrollY - 10;
    if (x + b.width > window.innerWidth - 12) x = r.left - b.width - 12;
    if (x < 12) x = 12;
    bulle.style.left = x + 'px';
    bulle.style.top = Math.max(window.scrollY + 8, y) + 'px';
  }
  function cacherBulle() { bulle.hidden = true; document.querySelectorAll('.surligne').forEach(function (n) { n.classList.remove('surligne'); }); }
  function cacherPlusTard() { fermeture = setTimeout(function () { if (!bulle.classList.contains('epinglee')) cacherBulle(); }, 350); }
  bulle.addEventListener('mouseenter', function () { clearTimeout(fermeture); });
  bulle.addEventListener('mouseleave', cacherPlusTard);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cacherBulle(); });
  document.addEventListener('click', function (ev) {
    if (!bulle.hidden && !bulle.contains(ev.target) && !ev.target.closest('.cible')) cacherBulle();
  });

  function rendreInteractif(noeud, contenu, cles) {
    noeud.classList.add('cible');
    noeud.setAttribute('tabindex', '0');
    noeud.setAttribute('role', 'button');
    function surligner() {
      document.querySelectorAll('.surligne').forEach(function (n) { n.classList.remove('surligne'); });
      (cles || []).forEach(function (cle) { document.querySelectorAll('[data-cle="' + cle + '"]').forEach(function (n) { n.classList.add('surligne'); }); });
    }
    noeud.addEventListener('mouseenter', function () { if (Date.now() < calmeJusqua) return; surligner(); montrerBulle(contenu(), noeud, false); });
    noeud.addEventListener('mouseleave', cacherPlusTard);
    noeud.addEventListener('focus', function () { surligner(); montrerBulle(contenu(), noeud, false); });
    noeud.addEventListener('click', function (ev) { ev.stopPropagation(); surligner(); montrerBulle(contenu(), noeud, true); });
    noeud.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); surligner(); montrerBulle(contenu(), noeud, true); var l = bulle.querySelector('a'); if (l) l.focus(); }
    });
  }

  /* ------------------------------------------------------------ la roue */
  function dessinerRoue(c, pourPdf) {
    var T = 600, cx = 300, cy = 300;
    var R = { ext: 292, zod: 250, graduation: 240, planetes: 210, maisons: 150, aspects: 124 };
    var origine = c.heure_connue ? c.points.Ascendant.longitude : 0;   // l'Ascendant à gauche ; sans heure, 0° Bélier
    function xy(lon, r) {
      var a = (lon - origine) * Math.PI / 180;
      return [cx - r * Math.cos(a), cy + r * Math.sin(a)];
    }
    var svg = el('svg', { viewBox: '0 0 ' + T + ' ' + T, class: 'roue', role: 'group',
                          'aria-label': 'Roue de la carte du ciel. Le tableau qui suit donne les mêmes informations.' });
    if (pourPdf) { svg.setAttribute('width', T); svg.setAttribute('height', T); }
    var fond = el('g', {}, svg);
    el('circle', { cx: cx, cy: cy, r: R.ext, fill: '#FFFDF8', stroke: '#B4830C', 'stroke-width': 1.2 }, fond);
    el('circle', { cx: cx, cy: cy, r: R.zod, fill: 'none', stroke: '#B4830C', 'stroke-width': 1 }, fond);
    el('circle', { cx: cx, cy: cy, r: R.aspects, fill: 'none', stroke: 'rgba(180,131,12,.45)', 'stroke-width': 0.8 }, fond);

    // les douze signes : un secteur chacun, sa couleur d'élément, son glyphe
    SIGNES.forEach(function (s, i) {
      var g = el('g', { 'data-cle': 'signe-' + s }, svg), a0 = i * 30, a1 = a0 + 30;
      var p0 = xy(a0, R.ext), p1 = xy(a1, R.ext), q1 = xy(a1, R.zod), q0 = xy(a0, R.zod);
      el('path', { d: 'M' + p0 + 'A' + R.ext + ' ' + R.ext + ' 0 0 0 ' + p1 + 'L' + q1 + 'A' + R.zod + ' ' + R.zod + ' 0 0 1 ' + q0 + 'Z',
                   fill: i % 2 ? 'rgba(180,131,12,.07)' : 'rgba(180,131,12,.02)', stroke: 'rgba(180,131,12,.5)', 'stroke-width': 0.8, class: 'secteur' }, g);
      var m = xy(a0 + 15, (R.ext + R.zod) / 2);
      glyphe(s, m[0], m[1], 22, g, ELEMENT[elementDe(s)]);
      if (!pourPdf) rendreInteractif(g, function () { return contenuSigne(c, s); }, ['signe-' + s]);
    });
    // graduations : tous les 5° (et 10° plus longues)
    for (var d = 0; d < 360; d += 5) {
      var a = xy(d, R.zod), b = xy(d, R.zod - (d % 10 ? 5 : 9));
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'rgba(180,131,12,.6)', 'stroke-width': 0.7 }, fond);
    }

    // les maisons (heure connue) : douze cuspides et leur numéro
    if (c.heure_connue) {
      c.maisons.forEach(function (m, i) {
        var g = el('g', { 'data-cle': 'maison-' + (i + 1) }, svg);
        var angle = i === 0 || i === 3 || i === 6 || i === 9;
        var a1 = xy(m.longitude, R.zod), a2 = xy(m.longitude, R.aspects);
        el('line', { x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1], stroke: angle ? '#071D29' : 'rgba(7,29,41,.35)', 'stroke-width': angle ? 1.6 : 0.8 }, g);
        var n = xy(m.longitude + 15, R.maisons - 12);
        el('circle', { cx: n[0], cy: n[1], r: 11, fill: 'rgba(255,253,248,.01)' }, g);
        var t = el('text', { x: n[0], y: n[1] + 4.5, 'text-anchor': 'middle', 'font-family': 'Spectral, Georgia, serif', 'font-size': 13, fill: '#6E6656' }, g);
        t.textContent = CHIFFRES_ROMAINS[i];
        if (!pourPdf) rendreInteractif(g, function () { return contenuMaison(c, i + 1); }, ['maison-' + (i + 1)]);
      });
      // l'axe Ascendant – Descendant et Milieu du Ciel, avec leurs étiquettes
      [['Ascendant', 'AC'], ['Milieu du Ciel', 'MC']].forEach(function (v) {
        var p = c.points[v[0]], g = el('g', { 'data-cle': 'point-' + v[0] }, svg);
        var e1 = xy(p.longitude, R.ext + 2), e2 = xy(p.longitude, R.aspects);
        el('line', { x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1], stroke: '#071D29', 'stroke-width': 2 }, g);
        var l = xy(p.longitude, R.ext - 14);
        var dx = v[1] === 'AC' ? -1 : 0;
        el('circle', { cx: l[0], cy: l[1], r: 13, fill: '#071D29' }, g);
        var t = el('text', { x: l[0] + dx, y: l[1] + 4.5, 'text-anchor': 'middle', 'font-family': 'Spectral, Georgia, serif', 'font-size': 12, fill: '#FAF7F0' }, g);
        t.textContent = v[1];
        if (!pourPdf) rendreInteractif(g, function () { return contenuPoint(c, v[0]); }, ['point-' + v[0]]);
      });
    }

    // les aspects : TOUS ceux du calcul, angles compris (même règle que la roue des thèmes, 24/09/2026).
    // Un trait entre les degrés exacts, or pour les accords, bleu nuit pour les tensions ; la conjonction,
    // trop courte pour un trait, est un petit arc épais le long du cercle des aspects.
    var traits = el('g', {}, svg);
    c.aspects.forEach(function (a, i) {
      var l1 = c.points[a.de].longitude, l2 = c.points[a.a].longitude;
      var g = el('g', { 'data-cle': 'aspect-' + i }, traits), forme;
      if (a.aspect === 'conjonction') {
        var d = ((l2 - l1 + 540) % 360) - 180, chemin = '';
        for (var k = 0; k <= 12; k++) { var m = xy(l1 + d * k / 12, R.aspects - 6); chemin += (k ? 'L' : 'M') + m[0].toFixed(1) + ' ' + m[1].toFixed(1); }
        forme = { d: chemin, fill: 'none' };
        el('path', Object.assign({ stroke: '#071D29', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: 0.85 }, forme), g);
      } else {
        var p = xy(l1, R.aspects), q = xy(l2, R.aspects);
        forme = { x1: p[0], y1: p[1], x2: q[0], y2: q[1] };
        el('line', Object.assign({ stroke: HARMONIE[a.aspect] ? '#B4830C' : '#071D29', 'stroke-width': a.ecart < 1 ? 1.8 : 1,
                                   'stroke-dasharray': a.aspect === 'sextile' ? '4 3' : 'none', opacity: 0.8 }, forme), g);
      }
      if (!pourPdf) {
        el(forme.d ? 'path' : 'line', Object.assign({ stroke: 'transparent', 'stroke-width': 9, fill: 'none' }, forme), g);   // zone de survol
        rendreInteractif(g, function () { return contenuAspect(a); }, ['aspect-' + i, 'point-' + a.de, 'point-' + a.a]);
      }
    });
    if (traits.childNodes.length !== c.aspects.length) console.error('roue : aspects manquants');

    // les planètes : écartées quand elles se touchent, un trait les relie à leur degré exact
    var pts = ORDRE.filter(function (n) { return c.points[n]; }).map(function (n) { return { nom: n, lon: c.points[n].longitude, aff: c.points[n].longitude }; });
    pts.sort(function (a, b) { return a.lon - b.lon; });
    for (var passe = 0; passe < 60; passe++) {
      var bouge = false;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        var ecart = ((b.aff - a.aff) + 360) % 360;
        if (pts.length > 1 && ecart < 7.5) { a.aff -= (7.5 - ecart) / 2; b.aff += (7.5 - ecart) / 2; bouge = true; }
      }
      if (!bouge) break;
    }
    pts.forEach(function (p) {
      var g = el('g', { 'data-cle': 'point-' + p.nom }, svg);
      var exact1 = xy(p.lon, R.zod), exact2 = xy(p.lon, R.zod - 12), pos = xy(p.aff, R.planetes);
      el('line', { x1: exact1[0], y1: exact1[1], x2: exact2[0], y2: exact2[1], stroke: '#071D29', 'stroke-width': 1.2 }, g);
      el('line', { x1: exact2[0], y1: exact2[1], x2: pos[0], y2: pos[1], stroke: 'rgba(7,29,41,.25)', 'stroke-width': 0.7 }, g);
      var point = xy(p.lon, R.aspects);
      el('circle', { cx: point[0], cy: point[1], r: 2, fill: '#071D29' }, g);
      el('circle', { cx: pos[0], cy: pos[1], r: 14, fill: 'rgba(255,253,248,.9)' }, g);
      glyphe(p.nom, pos[0], pos[1], 19, g, '#071D29');
      var pl = c.points[p.nom];
      if (pl.retrograde && ['Nœud Nord', 'Nœud Sud', 'Lune Noire'].indexOf(p.nom) < 0) {
        var r = xy(p.aff, R.planetes - 21);
        glyphe('rétrograde', r[0], r[1], 9, g, '#B4830C');
      }
      if (!pourPdf) rendreInteractif(g, function () { return contenuPoint(c, p.nom); }, ['point-' + p.nom]);
    });
    return svg;
  }

  /* ------------------------------------------------------------ le tableau et les aspects */
  function tableau(c) {
    var t = $('positions');
    t.innerHTML = '';
    var noms = ORDRE.concat(c.heure_connue ? ['Ascendant', 'Milieu du Ciel'] : []);
    noms.forEach(function (n) {
      var p = c.points[n];
      if (!p) return;
      var tr = html('tr');
      tr.setAttribute('data-cle', 'point-' + n);
      var td0 = html('td', 'g');
      if (GLYPHES[n]) td0.appendChild(petitGlyphe(n)); else td0.appendChild(html('span', 'sigle', n === 'Ascendant' ? 'AC' : 'MC'));
      tr.appendChild(td0);
      tr.appendChild(html('td', 'nom', n));
      var td2 = html('td');
      td2.appendChild(petitGlyphe(p.signe, 'signe'));
      td2.appendChild(document.createTextNode(' ' + position(p)));
      tr.appendChild(td2);
      tr.appendChild(html('td', null, p.maison ? CHIFFRES_ROMAINS[p.maison - 1] : '—'));
      tr.appendChild(html('td', 'retro', p.retrograde && ['Nœud Nord', 'Nœud Sud', 'Lune Noire'].indexOf(n) < 0 ? 'rétrograde' : ''));
      rendreInteractif(tr, function () { return contenuPoint(c, n); }, ['point-' + n]);
      t.appendChild(tr);
    });
    var ul = $('aspects');
    ul.innerHTML = '';
    c.aspects.forEach(function (a, i) {
      var li = html('li');
      li.setAttribute('data-cle', 'aspect-' + i);
      li.appendChild(document.createTextNode(a.de + ' '));
      li.appendChild(petitGlyphe(a.aspect, HARMONIE[a.aspect] ? 'accord' : 'tension'));
      li.appendChild(document.createTextNode(' ' + a.a));
      li.appendChild(html('span', 'ecart', ecartLisible(a.ecart)));
      rendreInteractif(li, function () { return contenuAspect(a); }, ['aspect-' + i, 'point-' + a.de, 'point-' + a.a]);
      ul.appendChild(li);
    });
    $('nb-aspects').textContent = c.aspects.length;
  }

  /* ------------------------------------------------------------ l'affichage complet */
  function resume(c, d) {
    return dateLisible(c.naissance.date) + (c.heure_connue ? ' à ' + heureLisible(c.naissance.heure) : ', heure inconnue') +
           ', ' + d.lieu.nom + (d.lieu.contexte ? ' (' + d.lieu.contexte + ')' : '');
  }
  function afficher(c) {
    var d = etat.demande;
    $('resume').textContent = resume(c, d);
    $('technique').textContent = 'Heure légale appliquée : ' + c.naissance.decalage + ' · temps universel : ' +
      utcLisible(c.naissance.heure_utc) + ' · fuseau ' + c.naissance.fuseau + ' · maisons égales, nœuds moyens, Lune Noire moyenne.';
    var trois = $('trois');
    trois.innerHTML = '';
    [['Soleil', 'Ton Soleil'], ['Lune', 'Ta Lune'], ['Ascendant', 'Ton Ascendant']].forEach(function (v) {
      var p = c.points[v[0]], div = html('div', 'repere');
      div.setAttribute('data-cle', 'point-' + v[0]);
      div.appendChild(html('b', null, v[1]));
      if (p) {
        var ligne = html('span', 'valeur');
        ligne.appendChild(petitGlyphe(p.signe, 'signe'));
        ligne.appendChild(document.createTextNode(' ' + p.signe));
        div.appendChild(ligne);
        div.appendChild(html('span', 'deg', p.degre));
        rendreInteractif(div, function () { return contenuPoint(c, v[0]); }, ['point-' + v[0]]);
      } else {
        div.appendChild(html('span', 'valeur', '—'));
        div.appendChild(html('span', 'deg', 'il faut l’heure de naissance'));
      }
      trois.appendChild(div);
    });
    var sans = $('sans-heure-note');
    if (!c.heure_connue) {
      var cl = c.course_lune;
      sans.hidden = false;
      sans.textContent = 'Sans heure de naissance, la carte est calculée à midi : ni Ascendant, ni Milieu du Ciel, ni maisons. ' +
        'La Lune avance d’environ 13° par jour : ce jour-là, elle allait de ' + position(cl.de) + ' à ' + position(cl.a) +
        (cl.change_de_signe ? ', et changeait donc de signe : son signe dépend de l’heure.' : ' : son signe est sûr, son degré non.') +
        ' La roue part de 0° Bélier, à gauche.';
    } else {
      sans.hidden = true;
    }
    var boite = $('roue');
    boite.innerHTML = '';
    boite.appendChild(dessinerRoue(c, false));
    tableau(c);
    calmeJusqua = Date.now() + 1200;
    cacherBulle();
    $('resultat').hidden = false;
    $('resultat').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('titre-resultat').focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------ le PDF, fabriqué dans le navigateur */
  function charger(src) {
    return new Promise(function (ok, ko) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function police(url) {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) {
      var o = new Uint8Array(b), s = '';
      for (var i = 0; i < o.length; i += 8192) s += String.fromCharCode.apply(null, o.subarray(i, i + 8192));
      return btoa(s);
    });
  }
  $('pdf').addEventListener('click', function () {
    var c = etat.carte, d = etat.demande, bouton = this;
    if (!c) return;
    bouton.disabled = true;
    bouton.textContent = 'Préparation du PDF…';
    Promise.all([charger('lib/jspdf.umd.min.js').then(function () { return charger('lib/svg2pdf.umd.min.js'); }),
                 police('lib/spectral-400.ttf'), police('lib/spectral-500.ttf')]).then(function (r) {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      doc.addFileToVFS('spectral-400.ttf', r[1]); doc.addFont('spectral-400.ttf', 'Spectral', 'normal');
      doc.addFileToVFS('spectral-500.ttf', r[2]); doc.addFont('spectral-500.ttf', 'Spectral', 'bold');
      var NAVY = [7, 29, 41], OR = [180, 131, 12], GRIS = [110, 102, 86], L = 210, M = 18;
      function texte(t, x, y, taille, style, couleur, opts) {
        doc.setFont('Spectral', style || 'normal'); doc.setFontSize(taille); doc.setTextColor.apply(doc, couleur || NAVY);
        doc.text(t, x, y, opts || {});
      }
      function pieds() {
        var n = doc.getNumberOfPages();
        for (var i = 1; i <= n; i++) {
          doc.setPage(i);
          doc.setDrawColor.apply(doc, OR); doc.setLineWidth(0.2); doc.line(M, 282, L - M, 282);
          texte('astrOrganic · astrorganic.fr · carte calculée, sans interprétation', M, 287, 8.5, 'normal', GRIS);
          texte(i + ' / ' + n, L - M, 287, 8.5, 'normal', GRIS, { align: 'right' });
        }
      }
      texte('CARTE DU CIEL', L / 2, 24, 10, 'normal', OR, { align: 'center', charSpace: 0.8 });
      texte(resume(c, d), L / 2, 33, 13, 'bold', NAVY, { align: 'center', maxWidth: L - 2 * M });
      var svg = dessinerRoue(c, true);
      document.body.appendChild(svg);
      return doc.svg(svg, { x: 22, y: 44, width: 166, height: 166 }).then(function () {
        svg.remove();
        var y = 222;
        [['Soleil', 'Soleil'], ['Lune', 'Lune'], ['Ascendant', 'Ascendant']].forEach(function (v, i) {
          var p = c.points[v[0]], x = M + 12 + i * 60;
          texte(v[1].toUpperCase(), x, y, 8.5, 'normal', OR, { charSpace: 0.5 });
          texte(p ? p.signe + ' ' + p.degre : '— (heure inconnue)', x, y + 7, 13, 'bold');
        });
        var note = c.heure_connue ? 'Maisons égales depuis l’Ascendant, nœuds moyens, Lune Noire moyenne. Heure légale ' + c.naissance.decalage + ', soit le ' + utcLisible(c.naissance.heure_utc) + ' en temps universel.'
          : 'Heure inconnue : carte calculée à midi, sans Ascendant ni maisons. Ce jour-là, la Lune allait de ' + position(c.course_lune.de) + ' à ' + position(c.course_lune.a) + '.';
        texte(note, L / 2, 243, 9.5, 'normal', GRIS, { align: 'center', maxWidth: L - 2 * M });
        texte('Calcul : Swiss Ephemeris (licence AGPL), fichiers 1800-2399. Lieu : ' + d.lieu.nom + ', ' + d.lieu.lat.toFixed(4) + ', ' + d.lieu.lon.toFixed(4) + ', fuseau ' + d.lieu.fuseau + '.', L / 2, 256, 8.5, 'normal', GRIS, { align: 'center', maxWidth: L - 2 * M });
        doc.addPage();
        texte('LES POSITIONS', M, 22, 10, 'normal', OR, { charSpace: 0.8 });
        y = 32;
        var noms = ORDRE.concat(c.heure_connue ? ['Ascendant', 'Milieu du Ciel'] : []);
        texte('Point', M, y, 8.5, 'normal', GRIS); texte('Position', M + 44, y, 8.5, 'normal', GRIS);
        texte('Maison', M + 90, y, 8.5, 'normal', GRIS); texte('Ce que c’est', M + 110, y, 8.5, 'normal', GRIS);
        y += 5;
        noms.forEach(function (n) {
          var p = c.points[n]; if (!p) return;
          doc.setDrawColor(230, 220, 200); doc.line(M, y - 3.6, L - M, y - 3.6);
          texte(n, M, y + 1, 10.5, 'bold');
          texte(position(p) + (p.retrograde && ['Nœud Nord', 'Nœud Sud', 'Lune Noire'].indexOf(n) < 0 ? ' R' : ''), M + 44, y + 1, 10.5);
          texte(p.maison ? CHIFFRES_ROMAINS[p.maison - 1] : '—', M + 90, y + 1, 10.5);
          var court = TEXTES.points[n].quoi.split('Dans la tradition')[1] || TEXTES.points[n].quoi;
          court = court.replace(/^( moderne)?, /, '').replace(/^./, function (x) { return x.toUpperCase(); });
          var lignes = doc.splitTextToSize(court, L - M - (M + 110));
          texte(lignes, M + 110, y + 1, 8.5, 'normal', GRIS);
          y += Math.max(8, lignes.length * 3.6 + 3.5);
        });
        texte('R : rétrograde, un effet de perspective vu depuis la Terre. Les descriptions sont celles de la tradition, pas une lecture de ta carte.', M, y + 2, 8, 'normal', GRIS, { maxWidth: L - 2 * M });
        y += 12;
        // les aspects : trois colonnes ; s'ils ne tiennent pas sous le tableau, ils prennent une page à eux
        var parColonne = Math.ceil(c.aspects.length / 3), besoin = 7 + parColonne * 4.6 + 18;
        if (y + besoin > 276) { doc.addPage(); y = 22; }
        texte('LES ASPECTS (' + c.aspects.length + ')', M, y, 10, 'normal', OR, { charSpace: 0.8 });
        y += 7;
        var y0 = y;
        c.aspects.forEach(function (a, i) {
          var col = Math.floor(i / parColonne), x = M + col * 58;
          texte(a.de + ' ' + a.aspect + ' ' + a.a + ' (' + ecartLisible(a.ecart) + ')', x, y0 + (i % parColonne) * 4.6, 8.5, 'normal', NAVY, { maxWidth: 56 });
        });
        y = y0 + parColonne * 4.6 + 8;
        texte('Ta carte, lue pour toi : la lecture complète de ton thème astral, 29 €, sur astrorganic.fr', L / 2, Math.max(y, 262), 10, 'bold', NAVY, { align: 'center' });
        pieds();
        doc.save('carte-du-ciel-' + c.naissance.date + '.pdf');
      });
    }).catch(function () {
      $('message-pdf').textContent = 'Le PDF n’a pas pu être fabriqué dans ce navigateur. La carte reste affichée à l’écran.';
    }).then(function () {
      bouton.disabled = false;
      bouton.textContent = 'Télécharger ma carte en PDF';
    });
  });
})();
