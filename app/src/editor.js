// Vice Coast Cover Studio — editor.
// Wires the controls to the poster state, loads photos (samples and uploads),
// runs face detection for face-aware crops, and handles panel dragging,
// zooming and PNG export. Photos are read on this machine and never leave it.

import {
  EXPORT_SIZES,
  LAYOUTS,
  GRADES,
  SAMPLES,
  ROLE_SUGGESTIONS,
  defaultState,
  visibleCells,
} from './state.js';
import {
  drawPoster,
  ensurePosterFonts,
  exportPosterPNG,
  visiblePanelRects,
} from './poster.js';
import { focusPointForPhoto } from './face.js';

const state = defaultState();
const photos = new Map();
let renderQueued = false;
let pendingUploadPanel = 0;
let readyResolve;
const ready = new Promise((resolve) => {
  readyResolve = resolve;
});

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const statusLine = $('statusLine');

function setStatus(text) {
  if (statusLine) statusLine.textContent = text;
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    drawPoster(ctx, canvas.width, canvas.height, state, photos);
  });
}

function renderNow() {
  drawPoster(ctx, canvas.width, canvas.height, state, photos);
}

// The preview canvas runs at most 960 px wide: the same drawing code as the
// export, just scaled, so it stays fast while dragging and typing.
function syncPreviewSize() {
  const size = EXPORT_SIZES[state.sizeId];
  const scale = Math.min(1, 960 / size.width);
  canvas.width = Math.round(size.width * scale);
  canvas.height = Math.round(size.height * scale);
  canvas.style.aspectRatio = `${size.width} / ${size.height}`;
}

function loadPhoto(src) {
  if (photos.has(src)) return Promise.resolve(photos.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      photos.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function focusPanelOnFace(panelIndex) {
  const panel = state.panels[panelIndex];
  if (!panel) return;
  const img = await loadPhoto(panel.src);
  if (!img) return;
  const focus = await focusPointForPhoto(img);
  panel.focusX = focus.x;
  panel.focusY = focus.y;
  panel.faceFound = focus.faceFound;
  if (focus.faceFound) setStatus(`Face found in panel ${panelIndex + 1} — crop centered on it.`);
  scheduleRender();
}

async function assignPhoto(panelIndex, src, label) {
  const panel = state.panels[panelIndex];
  if (!panel) return;
  panel.src = src;
  panel.label = label || panel.label;
  panel.zoom = 1;
  panel.dx = 0;
  panel.dy = 0;
  await loadPhoto(src);
  buildPanelList();
  scheduleRender();
  focusPanelOnFace(panelIndex);
}

function visiblePanelCount() {
  const size = EXPORT_SIZES[state.sizeId];
  return visibleCells(state, size.width, size.height).length;
}

function buildPicker(containerId, entries, activeId, onPick, renderButton) {
  const container = $(containerId);
  container.innerHTML = '';
  entries.forEach(([id, entry]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.pick = id;
    button.setAttribute('aria-pressed', id === activeId ? 'true' : 'false');
    renderButton(button, entry, id);
    button.addEventListener('click', () => onPick(id));
    container.appendChild(button);
  });
}

function buildLayoutPicker() {
  buildPicker(
    'layoutPicker',
    Object.entries(LAYOUTS),
    state.layoutId,
    (id) => {
      state.layoutId = id;
      state.selectedPanel = 0;
      buildLayoutPicker();
      buildPanelList();
      scheduleRender();
    },
    (button, layout) => {
      const diagram = document.createElement('span');
      diagram.className = 'layout-diagram';
      diagram.textContent = layout.cells.wide.length;
      const name = document.createElement('span');
      name.className = 'pick-name';
      name.textContent = layout.name;
      const blurb = document.createElement('span');
      blurb.className = 'pick-blurb';
      blurb.textContent = layout.blurb;
      button.append(diagram, name, blurb);
    },
  );
}

function buildGradePicker() {
  buildPicker(
    'gradePicker',
    Object.entries(GRADES),
    state.gradeId,
    (id) => {
      state.gradeId = id;
      buildGradePicker();
      scheduleRender();
    },
    (button, grade) => {
      const swatch = document.createElement('span');
      swatch.className = 'grade-swatch';
      swatch.style.background = grade.swatch;
      const name = document.createElement('span');
      name.className = 'pick-name';
      name.textContent = grade.name;
      button.append(swatch, name);
    },
  );
}

function buildSizePicker() {
  buildPicker(
    'sizePicker',
    Object.entries(EXPORT_SIZES),
    state.sizeId,
    (id) => {
      state.sizeId = id;
      state.selectedPanel = 0;
      syncPreviewSize();
      buildSizePicker();
      buildPanelList();
      scheduleRender();
    },
    (button, size) => {
      const name = document.createElement('span');
      name.className = 'pick-name';
      name.textContent = size.label;
      button.append(name);
    },
  );
}

// One row per visible panel: thumbnail, role and detail text, zoom slider,
// a sample picker and an upload button.
function buildPanelList() {
  const list = $('panelList');
  list.innerHTML = '';
  const count = visiblePanelCount();
  for (let index = 0; index < count; index += 1) {
    const panel = state.panels[index];
    const row = document.createElement('div');
    row.className = `panel-row${index === state.selectedPanel ? ' selected' : ''}`;
    row.dataset.panel = String(index);

    const thumb = document.createElement('img');
    thumb.className = 'panel-thumb';
    thumb.src = panel.src;
    thumb.alt = panel.label;
    thumb.addEventListener('click', () => {
      state.selectedPanel = index;
      buildPanelList();
      scheduleRender();
    });

    const fields = document.createElement('div');
    fields.className = 'panel-fields';
    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.value = panel.role;
    roleInput.setAttribute('list', 'roleOptions');
    roleInput.setAttribute('aria-label', `Role tag for panel ${index + 1}`);
    roleInput.addEventListener('input', () => {
      panel.role = roleInput.value.toUpperCase();
      scheduleRender();
    });
    const detailInput = document.createElement('input');
    detailInput.type = 'text';
    detailInput.value = panel.detail;
    detailInput.className = 'detail-input';
    detailInput.setAttribute('aria-label', `Detail line for panel ${index + 1}`);
    detailInput.addEventListener('input', () => {
      panel.detail = detailInput.value.toUpperCase();
      scheduleRender();
    });
    fields.append(roleInput, detailInput);

    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '100';
    zoom.max = '300';
    zoom.value = String(Math.round(panel.zoom * 100));
    zoom.setAttribute('aria-label', `Zoom for panel ${index + 1}`);
    zoom.addEventListener('input', () => {
      panel.zoom = Number(zoom.value) / 100;
      scheduleRender();
    });

    const sampleSelect = document.createElement('select');
    sampleSelect.setAttribute('aria-label', `Sample photo for panel ${index + 1}`);
    SAMPLES.forEach((sample) => {
      const option = document.createElement('option');
      option.value = sample.src;
      option.textContent = `${sample.label} · ${sample.role}`;
      sampleSelect.append(option);
    });
    if (!SAMPLES.some((sample) => sample.src === panel.src)) {
      const option = document.createElement('option');
      option.value = panel.src;
      option.textContent = 'Your photo';
      sampleSelect.append(option);
    }
    sampleSelect.value = panel.src;
    sampleSelect.addEventListener('change', () => {
      const sample = SAMPLES.find((item) => item.src === sampleSelect.value);
      assignPhoto(index, sampleSelect.value, sample ? sample.label : panel.label);
    });

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className = 'mini-btn';
    uploadButton.textContent = 'Upload';
    uploadButton.addEventListener('click', () => {
      pendingUploadPanel = index;
      $('fileInput').click();
    });

    const faceButton = document.createElement('button');
    faceButton.type = 'button';
    faceButton.className = 'mini-btn';
    faceButton.textContent = panel.faceFound ? 'Face ✓' : 'Find face';
    faceButton.addEventListener('click', () => focusPanelOnFace(index));

    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    actions.append(sampleSelect, uploadButton, faceButton);
    row.append(thumb, fields, zoom, actions);
    list.append(row);
  }
}

function bindTextInput(id, key, transform) {
  const input = $(id);
  input.value = state[key];
  input.addEventListener('input', () => {
    state[key] = transform ? transform(input.value) : input.value;
    scheduleRender();
  });
}

function bindControls() {
  bindTextInput('titleInput', 'title', (value) => value.toUpperCase());
  bindTextInput('subtitleInput', 'subtitle');
  bindTextInput('taglineInput', 'tagline', (value) => value.toUpperCase());
  bindTextInput('quoteInput', 'reviewQuote', (value) => value.toUpperCase());
  bindTextInput('sourceInput', 'reviewSource', (value) => value.toUpperCase());
  bindTextInput('volumeInput', 'volume', (value) => value.toUpperCase());
  bindTextInput('sealInput', 'sealText', (value) => value.toUpperCase());
  bindTextInput('billingInput', 'billing', (value) => value.toUpperCase());

  const stars = $('starsInput');
  stars.value = String(state.reviewStars);
  stars.addEventListener('change', () => {
    state.reviewStars = Number(stars.value);
    scheduleRender();
  });

  const popout = $('popoutToggle');
  popout.checked = state.popoutHero;
  popout.addEventListener('change', () => {
    state.popoutHero = popout.checked;
    scheduleRender();
  });
  const comingSoon = $('comingSoonToggle');
  comingSoon.checked = state.showComingSoon;
  comingSoon.addEventListener('change', () => {
    state.showComingSoon = comingSoon.checked;
    scheduleRender();
  });

  $('shuffleSamplesBtn').addEventListener('click', () => {
    const shuffled = [...SAMPLES].sort(() => Math.random() - 0.5);
    state.panels.forEach((panel, index) => {
      const sample = shuffled[index % shuffled.length];
      panel.src = sample.src;
      panel.label = sample.label;
      panel.role = sample.role;
      panel.detail = sample.detail;
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
    });
    Promise.all(state.panels.map((panel) => loadPhoto(panel.src))).then(() => {
      buildPanelList();
      scheduleRender();
      state.panels.forEach((_, index) => focusPanelOnFace(index));
    });
  });

  $('fillAllBtn').addEventListener('click', () => {
    const source = state.panels[state.selectedPanel];
    if (!source) return;
    state.panels.forEach((panel) => {
      panel.src = source.src;
      panel.label = source.label;
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
    });
    buildPanelList();
    scheduleRender();
    setStatus('One photo now fills every panel — drag each crop to vary them.');
  });

  $('fileInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    assignPhoto(pendingUploadPanel, url, file.name.replace(/\.[^.]+$/, ''));
    setStatus(`Loaded ${file.name} into panel ${pendingUploadPanel + 1}.`);
  });

  $('exportCurrentBtn').addEventListener('click', () => exportSize(state.sizeId));
  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => exportSize(button.dataset.export));
  });
}

async function exportSize(sizeId, options = {}) {
  const size = EXPORT_SIZES[sizeId];
  setStatus(`Rendering ${size.width} × ${size.height} PNG…`);
  const { blob } = await exportPosterPNG(state, photos, sizeId);
  if (options.returnBlob) return blob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vice-coast-cover-${size.width}x${size.height}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${size.width} × ${size.height} PNG — ready to post.`);
  return blob;
}

// Pointer math: client pixels to preview-canvas pixels, then to a panel.
function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  };
}

function panelIndexAt(point) {
  const rects = visiblePanelRects(state, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const rect = rects[i];
    if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
      return i;
    }
  }
  return -1;
}

function bindCanvasInteraction() {
  let dragging = false;
  let last = null;

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const index = panelIndexAt(point);
    if (index < 0) return;
    state.selectedPanel = index;
    buildPanelList();
    dragging = true;
    last = point;
    canvas.setPointerCapture(event.pointerId);
    scheduleRender();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || !last) return;
    const point = canvasPoint(event);
    const panel = state.panels[state.selectedPanel];
    const rects = visiblePanelRects(state, canvas.width, canvas.height);
    const rect = rects[state.selectedPanel];
    if (panel && rect) {
      panel.dx = Math.max(-0.5, Math.min(0.5, panel.dx - (point.x - last.x) / rect.w));
      panel.dy = Math.max(-0.5, Math.min(0.5, panel.dy - (point.y - last.y) / rect.h));
      scheduleRender();
    }
    last = point;
  });

  const endDrag = () => {
    dragging = false;
    last = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.zoom = Math.max(1, Math.min(4, panel.zoom * Math.exp(-event.deltaY * 0.0012)));
    buildPanelList();
    scheduleRender();
  }, { passive: false });

  canvas.addEventListener('dragover', (event) => event.preventDefault());
  canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const index = panelIndexAt(canvasPoint(event));
    const target = index >= 0 ? index : state.selectedPanel;
    const url = URL.createObjectURL(file);
    assignPhoto(target, url, file.name.replace(/\.[^.]+$/, ''));
    setStatus(`Dropped ${file.name} into panel ${target + 1}.`);
  });
}

async function init() {
  const datalist = $('roleOptions');
  ROLE_SUGGESTIONS.forEach((role) => {
    const option = document.createElement('option');
    option.value = role;
    datalist.append(option);
  });
  buildLayoutPicker();
  buildGradePicker();
  buildSizePicker();
  buildPanelList();
  bindControls();
  bindCanvasInteraction();
  syncPreviewSize();
  await ensurePosterFonts();
  await Promise.all(SAMPLES.map((sample) => loadPhoto(sample.src)));
  renderNow();
  setStatus('Sample photos loaded. Drop your own photos onto any panel.');
  readyResolve();
  state.panels.forEach((_, index) => focusPanelOnFace(index));
}

// Scripted handle for trying the app and taking screenshots: the same
// functions the buttons call, reachable from automation.
window.__viceCoast = {
  state,
  photos,
  ready,
  render: renderNow,
  setState(patch) {
    Object.assign(state, patch);
    syncPreviewSize();
    buildLayoutPicker();
    buildGradePicker();
    buildSizePicker();
    buildPanelList();
    renderNow();
  },
  setPanelPhoto(index, src) {
    return assignPhoto(index, src);
  },
  exportPNG(sizeId) {
    return exportSize(sizeId, { returnBlob: true });
  },
};

init();
