/* Calculateur d'astrOrganic — AGPL-3.0 ou ultérieure.
   La pédagogie du survol : pour chaque élément de la carte, ce que c'est (le fait), ce que la tradition en lit
   (annoncé comme tel), et l'article du carnet qui va plus loin. Aucune interprétation de la carte de la personne :
   le calculateur dit ce qu'est un Mars en général, jamais ce que « ton » Mars dit de toi. */
var CARNET = 'https://astrorganic.fr/carnet/';
var BRIQUES = { url: CARNET + 'comment-fonctionne-l-astrologie/', titre: 'Comment fonctionne l’astrologie' };
var MAISONS_ART = { url: CARNET + 'les-douze-maisons/', titre: 'Les douze maisons' };

var TEXTES = {
  points: {
    'Soleil': { quoi: 'L’étoile autour de laquelle tourne la Terre ; vu d’ici, il parcourt le zodiaque en un an. Dans la tradition, la fonction qui rayonne et affirme : ce vers quoi on tend en devenant soi.', url: CARNET + 'le-soleil/', titre: 'Le Soleil dans le thème' },
    'Lune': { quoi: 'Le satellite de la Terre, qui change de signe tous les deux jours et demi. Dans la tradition, la fonction qui ressent et protège : ce dont on a besoin pour se sentir en sécurité.', url: CARNET + 'la-lune/', titre: 'La Lune dans le thème' },
    'Mercure': { quoi: 'La planète la plus proche du Soleil, jamais à plus de 28° de lui. Dans la tradition, la fonction qui pense, parle et relie.', url: CARNET + 'mercure/', titre: 'Mercure' },
    'Vénus': { quoi: 'La planète la plus brillante du ciel, jamais à plus de 47° du Soleil. Dans la tradition, la fonction qui attire, apprécie et accorde : ce à quoi on tient.', url: CARNET + 'venus/', titre: 'Vénus' },
    'Mars': { quoi: 'La planète rouge, qui met environ deux ans à faire le tour du zodiaque. Dans la tradition, la fonction qui veut, agit et se défend.', url: CARNET + 'mars/', titre: 'Mars' },
    'Jupiter': { quoi: 'La plus grosse planète, qui reste environ un an dans chaque signe. Dans la tradition, la fonction qui ouvre et fait grandir, avec le revers du trop.', url: CARNET + 'jupiter/', titre: 'Jupiter' },
    'Saturne': { quoi: 'La planète aux anneaux, deux ans et demi par signe, 29 ans pour faire le tour. Dans la tradition, la fonction qui structure, pose des limites et vérifie que ça tient.', url: CARNET + 'saturne/', titre: 'Saturne' },
    'Uranus': { quoi: 'Planète lente, découverte en 1781, sept ans par signe : elle est partagée par toute une génération. Dans la tradition moderne, ce qui bouscule et libère.', url: CARNET + 'uranus/', titre: 'Uranus' },
    'Neptune': { quoi: 'Planète lente, découverte en 1846, environ quatorze ans par signe. Dans la tradition moderne, ce qui dissout les contours et nourrit l’imaginaire.', url: CARNET + 'neptune/', titre: 'Neptune' },
    'Pluton': { quoi: 'Planète naine, découverte en 1930, de onze à trente-deux ans par signe selon son orbite. Dans la tradition moderne, ce qui transforme en profondeur.', url: CARNET + 'pluton/', titre: 'Pluton' },
    'Chiron': { quoi: 'Un petit astre entre Saturne et Uranus, découvert en 1977. Dans la tradition moderne, la zone de vulnérabilité : là où ça fait mal, et ce qu’on en apprend.', url: CARNET + 'chiron/', titre: 'Chiron' },
    'Lune Noire': { quoi: 'Pas un astre : un point calculé, le point de l’orbite de la Lune le plus éloigné de la Terre (ici en position moyenne). Dans la tradition, la part la plus brute, ce qui ne se négocie pas.', url: CARNET + 'la-lune-noire/', titre: 'La Lune Noire dans le thème' },
    'Nœud Nord': { quoi: 'Pas un astre : un des deux points où l’orbite de la Lune croise la route du Soleil (ici en position moyenne). Les éclipses ne se produisent que près des Nœuds. Dans la tradition, la direction qui fait grandir.', url: CARNET + 'les-noeuds-lunaires/', titre: 'Les Nœuds lunaires' },
    'Nœud Sud': { quoi: 'Le point exactement opposé au Nœud Nord. Dans la tradition, la zone de confort : ce qu’on sait déjà faire, ce qui revient par habitude. Une ressource, pas un défaut.', url: CARNET + 'les-noeuds-lunaires/', titre: 'Les Nœuds lunaires' },
    'Ascendant': { quoi: 'Le degré du zodiaque qui se levait à l’est, à l’heure et au lieu de la naissance. Il change de signe environ toutes les deux heures, et ouvre la Maison I. Dans la tradition, la manière d’arriver dans le monde.', url: CARNET + 'l-ascendant/', titre: 'L’Ascendant' },
    'Milieu du Ciel': { quoi: 'Le degré du zodiaque qui passait au méridien du lieu, là où le Soleil culmine à midi, à l’heure de la naissance. Dans la tradition, ce qui se voit de loin : la vocation, la place sociale.', url: MAISONS_ART.url, titre: 'Les douze maisons' }
  },
  signes: {
    'Bélier': 'Feu, cardinal. Dans la tradition, la manière de l’élan : commencer, foncer, être le premier.',
    'Taureau': 'Terre, fixe. Dans la tradition, la manière de ce qui s’installe et se savoure : le concret, la durée.',
    'Gémeaux': 'Air, mutable. Dans la tradition, la manière de la curiosité : relier, échanger, varier.',
    'Cancer': 'Eau, cardinal. Dans la tradition, la manière de ce qui protège et nourrit : le proche, le foyer.',
    'Lion': 'Feu, fixe. Dans la tradition, la manière de ce qui s’exprime et rayonne : créer, se montrer.',
    'Vierge': 'Terre, mutable. Dans la tradition, la manière du tri et de l’ajustement : faire bien, servir.',
    'Balance': 'Air, cardinal. Dans la tradition, la manière du lien et de l’équilibre : peser, accorder.',
    'Scorpion': 'Eau, fixe. Dans la tradition, la manière de ce qui va au fond : l’intensité, la transformation.',
    'Sagittaire': 'Feu, mutable. Dans la tradition, la manière de l’horizon : chercher du sens, viser loin.',
    'Capricorne': 'Terre, cardinal. Dans la tradition, la manière de ce qui se construit dans le temps : l’effort, la structure.',
    'Verseau': 'Air, fixe. Dans la tradition, la manière du pas de côté : le collectif, l’indépendance.',
    'Poissons': 'Eau, mutable. Dans la tradition, la manière de ce qui se fond : l’empathie, l’imaginaire.'
  },
  maisons: [
    'la manière d’arriver dans le monde : l’allure, les réflexes, les départs',
    'les ressources et les valeurs : ce qu’on possède, ce qui compte',
    'la parole et l’entourage proche : apprendre, écrire, frères et sœurs',
    'le foyer et les racines : la famille, le chez-soi',
    'le plaisir et la création : les enfants, les amours légères, le jeu',
    'le quotidien : le travail de tous les jours, le corps, les habitudes',
    'les relations engagées : le couple, les associés, l’autre en face',
    'ce qui se partage en profondeur : l’intimité, l’argent commun, les crises',
    'les convictions et le lointain : les études, les voyages, le sens',
    'la vocation : la place sociale, ce qu’on construit aux yeux de tous',
    'les amitiés et les projets : le groupe, ce qu’on espère',
    'la vie intérieure : ce qui se vit en retrait, ce qui ne se montre pas'
  ],
  aspects: {
    'conjonction': { angle: '0°', quoi: 'Deux points au même endroit du zodiaque. Dans la tradition, deux fonctions fondues : elles agissent ensemble, sans pouvoir se séparer.' },
    'sextile': { angle: '60°', quoi: 'Deux points à 60° l’un de l’autre. Dans la tradition, une coopération facile, qui demande un geste pour se mettre en route.' },
    'carré': { angle: '90°', quoi: 'Deux points à 90° l’un de l’autre. Dans la tradition, une tension qui pousse à agir : ça frotte, et ça fait bouger.' },
    'trigone': { angle: '120°', quoi: 'Deux points à 120° l’un de l’autre. Dans la tradition, une circulation fluide, un talent qui coule de source.' },
    'opposition': { angle: '180°', quoi: 'Deux points face à face. Dans la tradition, deux pôles qui se répondent et demandent un équilibre.' }
  },
  retrograde: { quoi: 'Rétrograde : vue depuis la Terre, la planète semble reculer dans le zodiaque. C’est un effet de perspective, pas un vrai recul. Dans la tradition, une fonction qui se tourne vers l’intérieur, qui revient sur ses pas.', url: CARNET + 'mercure-retrograde/', titre: 'Mercure rétrograde : ce que c’est vraiment' }
};
var CHIFFRES_ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
