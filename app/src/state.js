// Vice Coast Cover Studio — state, layouts, grades and sample photos.
// All coordinates for poster cells are fractions of the poster width/height,
// so one layout definition serves every export size. Aspect classes:
// "wide" covers 16:9 and 1:1 posters, "tall" covers the 4:5 poster.

export const EXPORT_SIZES = {
  wide: { label: '16:9 · 1920 × 1080', width: 1920, height: 1080 },
  square: { label: '1:1 · 1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: '4:5 · 1080 × 1350', width: 1080, height: 1350 },
};

export function aspectClassFor(width, height) {
  return width / height >= 1 ? 'wide' : 'tall';
}

// A cell is one photo panel: x/y/w/h in fractions, slant in fractions of the
// panel width (positive leans the top edge right), hero marks the close-up.
export const LAYOUTS = {
  seven: {
    name: 'Vice Seven',
    blurb: 'Seven panels, hero close-up up top',
    titleY: { wide: 0.545, tall: 0.5 },
    cells: {
      wide: [
        { x: 0.012, y: 0.055, w: 0.235, h: 0.385, slant: 0.03 },
        { x: 0.252, y: 0.055, w: 0.275, h: 0.385, slant: -0.03, hero: true },
        { x: 0.532, y: 0.055, w: 0.225, h: 0.385, slant: 0.03 },
        { x: 0.762, y: 0.055, w: 0.226, h: 0.385, slant: -0.03 },
        { x: 0.012, y: 0.445, w: 0.3, h: 0.4, slant: -0.03 },
        { x: 0.317, y: 0.445, w: 0.335, h: 0.4, slant: 0.03 },
        { x: 0.657, y: 0.445, w: 0.331, h: 0.4, slant: -0.03 },
      ],
      tall: [
        { x: 0.012, y: 0.055, w: 0.976, h: 0.3, slant: 0.015, hero: true },
        { x: 0.012, y: 0.36, w: 0.485, h: 0.24, slant: 0.03 },
        { x: 0.503, y: 0.36, w: 0.485, h: 0.24, slant: -0.03 },
        { x: 0.012, y: 0.605, w: 0.485, h: 0.24, slant: -0.03 },
        { x: 0.503, y: 0.605, w: 0.485, h: 0.24, slant: 0.03 },
      ],
    },
  },
  five: {
    name: 'Harbor Five',
    blurb: 'Tall hero on the left, four panels right',
    titleY: { wide: 0.55, tall: 0.52 },
    cells: {
      wide: [
        { x: 0.012, y: 0.055, w: 0.3, h: 0.79, slant: 0.025, hero: true },
        { x: 0.317, y: 0.055, w: 0.335, h: 0.39, slant: -0.03 },
        { x: 0.657, y: 0.055, w: 0.331, h: 0.39, slant: 0.03 },
        { x: 0.317, y: 0.45, w: 0.335, h: 0.395, slant: 0.03 },
        { x: 0.657, y: 0.45, w: 0.331, h: 0.395, slant: -0.03 },
      ],
      tall: [
        { x: 0.012, y: 0.055, w: 0.976, h: 0.34, slant: 0.015, hero: true },
        { x: 0.012, y: 0.4, w: 0.485, h: 0.22, slant: 0.03 },
        { x: 0.503, y: 0.4, w: 0.485, h: 0.22, slant: -0.03 },
        { x: 0.012, y: 0.625, w: 0.485, h: 0.22, slant: -0.03 },
        { x: 0.503, y: 0.625, w: 0.485, h: 0.22, slant: 0.03 },
      ],
    },
  },
  four: {
    name: 'Boulevard Four',
    blurb: 'Four tall vertical panels',
    titleY: { wide: 0.58, tall: 0.5 },
    cells: {
      wide: [
        { x: 0.012, y: 0.055, w: 0.235, h: 0.79, slant: 0.02, hero: true },
        { x: 0.252, y: 0.055, w: 0.24, h: 0.79, slant: -0.02 },
        { x: 0.497, y: 0.055, w: 0.24, h: 0.79, slant: 0.02 },
        { x: 0.742, y: 0.055, w: 0.246, h: 0.79, slant: -0.02 },
      ],
      tall: [
        { x: 0.012, y: 0.055, w: 0.485, h: 0.39, slant: 0.03, hero: true },
        { x: 0.503, y: 0.055, w: 0.485, h: 0.39, slant: -0.03 },
        { x: 0.012, y: 0.45, w: 0.485, h: 0.395, slant: -0.03 },
        { x: 0.503, y: 0.45, w: 0.485, h: 0.395, slant: 0.03 },
      ],
    },
  },
};

// A grade is a canvas filter plus a tint gradient painted over each panel
// with a composite blend. "painterly" also posterizes the photo first.
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.4) contrast(1.08) brightness(1.03) sepia(0.16)',
    overlay: ['rgba(255,122,40,0.20)', 'rgba(255,0,110,0.22)'],
    swatch: 'linear-gradient(135deg,#ffb347,#ff2e63)',
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.65) contrast(1.15) hue-rotate(12deg)',
    overlay: ['rgba(0,229,255,0.20)', 'rgba(255,0,170,0.26)'],
    swatch: 'linear-gradient(135deg,#00e5ff,#ff00aa)',
  },
  golden: {
    name: 'Golden Hour',
    filter: 'sepia(0.32) saturate(1.25) contrast(1.06)',
    overlay: ['rgba(255,200,60,0.22)', 'rgba(180,80,0,0.20)'],
    swatch: 'linear-gradient(135deg,#ffe27a,#c47a00)',
  },
  painterly: {
    name: 'Painted Poster',
    filter: 'saturate(1.55) contrast(1.12)',
    overlay: ['rgba(255,140,60,0.14)', 'rgba(120,0,140,0.18)'],
    posterize: 6,
    swatch: 'linear-gradient(135deg,#ff9a5c,#7b2ff7)',
  },
  noir: {
    name: 'Midnight Noir',
    filter: 'grayscale(0.85) contrast(1.28) brightness(0.96)',
    overlay: ['rgba(0,60,90,0.28)', 'rgba(10,0,30,0.30)'],
    swatch: 'linear-gradient(135deg,#9db4c0,#0a0a1a)',
  },
  vicepop: {
    name: 'Vice Pop',
    filter: 'saturate(1.95) contrast(1.1) hue-rotate(-12deg)',
    overlay: ['rgba(255,60,180,0.20)', 'rgba(0,220,255,0.18)'],
    swatch: 'linear-gradient(135deg,#ff3cb4,#00dcff)',
  },
};

// Sample photos shipped with the app. boulevard.jpg and pier.jpg came with the
// make.fun kit (made with an image model, free to use); the rest were made
// with an image model for this app. Every one is an original fictional scene.
export const SAMPLES = [
  { src: 'samples/hero-woman.jpg', label: 'Driver', role: 'THE DRIVER', detail: 'OCEAN DRIVE · 6:42 PM' },
  { src: 'samples/boss-man.jpg', label: 'Boss', role: 'THE BOSS', detail: 'ROOFTOP BAR · 8:05 PM' },
  { src: 'samples/mechanic-woman.jpg', label: 'Mechanic', role: 'THE MECHANIC', detail: 'NEON GARAGE · 9:40 PM' },
  { src: 'samples/captain-man.jpg', label: 'Captain', role: 'THE CAPTAIN', detail: 'MARINA DEL SOL · 7:48 PM' },
  { src: 'samples/getaway-car.jpg', label: 'Getaway', role: 'THE GETAWAY', detail: 'COAST HIGHWAY · FULL THROTTLE' },
  { src: 'samples/motel-neon.jpg', label: 'Hideout', role: 'THE HIDEOUT', detail: 'PALM COURT · VACANCY' },
  { src: 'samples/boulevard.jpg', label: 'Rider', role: 'THE RIDER', detail: 'PALM BOULEVARD · GOLDEN HOUR' },
  { src: 'samples/pier.jpg', label: 'Lookout', role: 'THE LOOKOUT', detail: 'SUNSET PIER · SEES EVERYTHING' },
];

export const ROLE_SUGGESTIONS = [
  'THE DRIVER', 'THE BOSS', 'THE MECHANIC', 'THE CAPTAIN', 'THE RIDER',
  'THE FIXER', 'THE LOOKOUT', 'THE BRAINS', 'THE GETAWAY', 'THE HIDEOUT',
  'THE ESCAPE', 'THE COURIER', 'THE INSIDER', 'THE WHEELMAN',
];

function defaultPanel(sample, index) {
  return {
    src: sample.src,
    label: sample.label,
    role: sample.role,
    detail: sample.detail,
    zoom: 1,
    dx: 0,
    dy: 0,
    focusX: 0.5,
    focusY: 0.35,
    faceFound: false,
    key: `panel-${index}`,
  };
}

export function defaultState() {
  return {
    layoutId: 'seven',
    gradeId: 'sunset',
    sizeId: 'wide',
    title: 'VICE COAST',
    subtitle: 'Salt & Sirens',
    tagline: 'SEVEN LIVES · ONE COAST · NO WAY BACK',
    reviewQuote: 'PURE SALT-WATER MAYHEM',
    reviewSource: 'THE HARBOR POST',
    reviewStars: 5,
    volume: 'VOL. 1',
    sealText: 'ORIGINAL COVER ART',
    billing: 'A VICE COAST PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND',
    showComingSoon: true,
    popoutHero: true,
    selectedPanel: 0,
    // Seven panels by default: four portraits, the car, the motel and the
    // pier lookout. The boulevard sample stays in the picker.
    panels: [0, 1, 2, 3, 4, 5, 7].map((sampleIndex, index) =>
      defaultPanel(SAMPLES[sampleIndex], index),
    ),
  };
}

export function visibleCells(state, width, height) {
  const layout = LAYOUTS[state.layoutId] ?? LAYOUTS.seven;
  return layout.cells[aspectClassFor(width, height)];
}

export function titleYFor(state, width, height) {
  const layout = LAYOUTS[state.layoutId] ?? LAYOUTS.seven;
  return layout.titleY[aspectClassFor(width, height)];
}
