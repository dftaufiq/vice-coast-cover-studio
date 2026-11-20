// Vice Coast Cover Studio — poster renderer.
// Draws the whole cover onto any 2D canvas context: panels, chrome title,
// script subtitle, role tags, review strip, seal, billing block and barcode.
// The editor preview and the PNG export both call drawPoster, so what you
// see is exactly what you share. All layout math is resolution independent.

import { EXPORT_SIZES, GRADES, visibleCells, titleYFor } from './state.js';

const FONT_SPECS = ['100px Anton', '100px Pacifico', '100px "Bebas Neue"'];

// The poster fonts are @font-face files under app/fonts/. Canvas text needs
// them loaded before measuring or drawing, so call this before any render.
export async function ensurePosterFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    // A missing font falls back to the next family in the stack; the poster
    // still draws, just without its display lettering.
  }
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pixel rect of a layout cell on a poster of this size.
export function cellRectPx(cell, width, height) {
  return {
    x: cell.x * width,
    y: cell.y * height,
    w: cell.w * width,
    h: cell.h * height,
    slant: cell.slant * cell.w * width,
  };
}

// Pixel rects of the panels the current layout shows, in panel order.
export function visiblePanelRects(state, width, height) {
  return visibleCells(state, width, height).map((cell) => cellRectPx(cell, width, height));
}

// The source rectangle of a photo drawn cover-fit into a panel: the crop
// keeps the panel's focus point (a detected face, or the upper third) in
// frame, zoomed by panel.zoom and nudged by panel.dx / panel.dy.
export function sourceRectForPhoto(img, rect, panel) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cover = Math.max(rect.w / iw, rect.h / ih);
  const zoom = Math.max(1, panel.zoom || 1) * cover;
  const sw = rect.w / zoom;
  const sh = rect.h / zoom;
  const fx = (panel.focusX ?? 0.5) * iw;
  const fy = (panel.focusY ?? 0.35) * ih;
  let sx = fx - sw / 2 + (panel.dx || 0) * sw;
  let sy = fy - sh / 2 + (panel.dy || 0) * sh;
  sx = Math.min(Math.max(sx, 0), Math.max(0, iw - sw));
  sy = Math.min(Math.max(sy, 0), Math.max(0, ih - sh));
  return { sx, sy, sw, sh };
}

function panelPath(ctx, rect) {
  const { x, y, w, h, slant } = rect;
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Quantize an offscreen canvas to a few levels per channel: the flat,
// illustrated look of the Painted Poster grade.
function posterizeCanvas(canvas, levels) {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// The photo of one panel, cropped, graded and (for the painterly grade)
// posterized, drawn inside the panel's clipped path.
function drawPanelPhoto(ctx, rect, img, panel, grade) {
  ctx.save();
  panelPath(ctx, rect);
  ctx.clip();
  const source = sourceRectForPhoto(img, rect, panel);
  if (grade.posterize) {
    const scale = Math.min(1, 900 / Math.max(1, rect.w));
    const off = document.createElement('canvas');
    off.width = Math.max(2, Math.round(rect.w * scale));
    off.height = Math.max(2, Math.round(rect.h * scale));
    const octx = off.getContext('2d');
    octx.drawImage(img, source.sx, source.sy, source.sw, source.sh, 0, 0, off.width, off.height);
    posterizeCanvas(off, grade.posterize);
    ctx.filter = grade.filter;
    ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
    ctx.filter = 'none';
  } else {
    ctx.filter = grade.filter;
    ctx.drawImage(img, source.sx, source.sy, source.sw, source.sh, rect.x, rect.y, rect.w, rect.h);
    ctx.filter = 'none';
  }
  const tint = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  tint.addColorStop(0, grade.overlay[0]);
  tint.addColorStop(1, grade.overlay[1]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawPanelPlaceholder(ctx, rect, label) {
  ctx.save();
  panelPath(ctx, rect);
  ctx.clip();
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, '#3b1d5e');
  g.addColorStop(1, '#1c0b33');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${Math.max(12, rect.h * 0.07)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label || 'ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

// Deep plum dusk gradient with a warm glow behind the title zone, plus a
// skyline and palm silhouettes along the bottom billing strip.
function drawBackdrop(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#170a2a');
  sky.addColorStop(0.45, '#2a1248');
  sky.addColorStop(0.8, '#1c0b33');
  sky.addColorStop(1, '#0e0618');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5, height * 0.55, 0,
    width * 0.5, height * 0.55, width * 0.55,
  );
  glow.addColorStop(0, 'rgba(255,80,140,0.20)');
  glow.addColorStop(0.5, 'rgba(255,120,60,0.10)');
  glow.addColorStop(1, 'rgba(255,80,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawSkyline(ctx, width, height) {
  const base = height * 0.985;
  const rand = mulberry32(20261121);
  ctx.fillStyle = 'rgba(8,2,18,0.85)';
  let x = -width * 0.01;
  while (x < width * 1.01) {
    const bw = width * (0.02 + rand() * 0.045);
    const bh = height * (0.012 + rand() * 0.038);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rand() > 0.5) ctx.fillRect(x + bw * 0.42, base - bh - height * 0.008, bw * 0.16, height * 0.008);
    const windows = 2 + Math.floor(rand() * 4);
    ctx.fillStyle = 'rgba(255,214,120,0.75)';
    for (let i = 0; i < windows; i += 1) {
      const wx = x + bw * (0.15 + rand() * 0.7);
      const wy = base - bh * (0.15 + rand() * 0.7);
      ctx.fillRect(wx, wy, Math.max(1.5, width * 0.0016), Math.max(1.5, width * 0.0016));
    }
    ctx.fillStyle = 'rgba(8,2,18,0.85)';
    x += bw + width * 0.004;
  }
}

function drawPalm(ctx, x, y, size, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(8,2,18,0.9)';
  ctx.fillStyle = 'rgba(8,2,18,0.9)';
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * size * 0.3, -size * 0.55, lean * size * 0.55, -size);
  ctx.stroke();
  const topX = lean * size * 0.55;
  const topY = -size;
  for (let i = 0; i < 7; i += 1) {
    const angle = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = size * (0.42 + (i % 3) * 0.06);
    const ex = topX + Math.cos(angle) * len * (lean < 0 ? -1 : 1);
    const ey = topY + Math.sin(angle) * len * 0.55 + size * 0.12;
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (ex - topX) * 0.5, topY - size * 0.12, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// One photo panel: drop shadow, graded photo, gold frame and role tag.
// scale > 1 pops the panel over its neighbours (the hero pop-out).
function drawPanel(ctx, rect, img, panel, grade, options = {}) {
  const scale = options.scale || 1;
  const border = options.border || 'rgba(255,214,130,0.9)';
  const borderWidth = options.borderWidth || 2;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const scaled = {
    x: cx - (rect.w * scale) / 2,
    y: cy - (rect.h * scale) / 2,
    w: rect.w * scale,
    h: rect.h * scale,
    slant: rect.slant * scale,
  };
  ctx.save();
  if (options.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = options.shadow;
    ctx.shadowOffsetY = options.shadow * 0.35;
  }
  panelPath(ctx, scaled);
  ctx.fillStyle = '#1c0b33';
  ctx.fill();
  ctx.restore();

  if (img) drawPanelPhoto(ctx, scaled, img, panel, grade);
  else drawPanelPlaceholder(ctx, scaled, panel.label);

  ctx.save();
  panelPath(ctx, scaled);
  ctx.strokeStyle = border;
  ctx.lineWidth = borderWidth;
  ctx.stroke();
  ctx.restore();

  drawRoleTag(ctx, scaled, panel);
}

// The slanted name tag pinned to a panel's bottom-left corner:
// role in large caps, with a smaller place-and-time line under it.
function drawRoleTag(ctx, rect, panel) {
  if (!panel.role) return;
  const pad = Math.max(6, rect.w * 0.02);
  const roleSize = Math.max(11, Math.min(rect.h * 0.11, rect.w * 0.085));
  const detailSize = roleSize * 0.52;
  const hasDetail = Boolean(panel.detail) && rect.h > roleSize * 4.2;
  const tagH = hasDetail ? roleSize * 1.15 + detailSize * 1.5 : roleSize * 1.5;
  const tagW = Math.min(rect.w * 0.94, roleSize * (panel.role.length * 0.52 + 1.6));
  const x = rect.x + pad;
  const y = rect.y + rect.h - pad - tagH;
  const skew = tagH * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + tagW, y);
  ctx.lineTo(x + tagW - skew, y + tagH);
  ctx.lineTo(x, y + tagH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,2,22,0.88)';
  ctx.fill();
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + skew + Math.max(3, roleSize * 0.16), y);
  ctx.lineTo(x + Math.max(3, roleSize * 0.16), y + tagH);
  ctx.lineTo(x, y + tagH);
  ctx.closePath();
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${roleSize}px "Bebas Neue", sans-serif`;
  const textX = x + skew + roleSize * 0.42;
  ctx.fillText(panel.role, textX, y + roleSize * 1.02);
  if (hasDetail) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `${detailSize}px "Bebas Neue", sans-serif`;
    ctx.fillText(panel.detail, textX, y + roleSize * 1.15 + detailSize * 1.15);
  }
  ctx.restore();
}

// The striped retro-chrome title: a dark 3D extrusion, a thick outline and
// a banded sunset gradient fill with a neon glow.
function drawChromeTitle(ctx, width, height, title, centerY) {
  const lines = String(title || 'VICE COAST').toUpperCase().split('\n');
  // Sized by width, but capped by height so the title never swallows the
  // panels' faces on wide posters.
  let size = Math.min(width * 0.135, height * 0.17);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fits = () => {
    ctx.font = `${size}px Anton, sans-serif`;
    return lines.every((line) => ctx.measureText(line).width <= width * 0.94);
  };
  while (size > width * 0.04 && !fits()) size *= 0.94;
  const lineHeight = size * 0.98;
  const blockHeight = lines.length * lineHeight;
  const top = centerY - blockHeight / 2;

  ctx.save();
  ctx.translate(width / 2, centerY);
  ctx.scale(1, 0.42);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.52);
  glow.addColorStop(0, 'rgba(16,2,32,0.62)');
  glow.addColorStop(1, 'rgba(16,2,32,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-width * 0.52, -width * 0.52, width * 1.04, width * 1.04);
  ctx.restore();

  lines.forEach((line, index) => {
    const baseline = top + lineHeight * (index + 0.82);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const depth = size * 0.05;
    ctx.fillStyle = '#20083f';
    for (let step = 4; step >= 1; step -= 1) {
      ctx.fillText(line, width / 2 + (depth * step) / 4, baseline + (depth * step) / 3);
    }
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = '#16042a';
    ctx.strokeText(line, width / 2, baseline);
    const chrome = ctx.createLinearGradient(0, baseline - size * 0.82, 0, baseline + size * 0.18);
    chrome.addColorStop(0, '#fffbe0');
    chrome.addColorStop(0.22, '#ffe066');
    chrome.addColorStop(0.3, '#ff8a2e');
    chrome.addColorStop(0.42, '#ff2e63');
    chrome.addColorStop(0.5, '#c44dff');
    chrome.addColorStop(0.58, '#ffe066');
    chrome.addColorStop(0.66, '#ff9d2e');
    chrome.addColorStop(0.8, '#ff2e88');
    chrome.addColorStop(1, '#ff7ab8');
    ctx.save();
    ctx.shadowColor = 'rgba(255,46,136,0.75)';
    ctx.shadowBlur = size * 0.16;
    ctx.fillStyle = chrome;
    ctx.fillText(line, width / 2, baseline);
    ctx.restore();
    ctx.lineWidth = size * 0.012;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeText(line, width / 2, baseline);
  });
  return { size, bottom: top + blockHeight };
}

function drawSubtitle(ctx, width, height, subtitle, belowY, titleSize) {
  if (!subtitle) return belowY;
  const size = titleSize * 0.42;
  ctx.save();
  ctx.translate(width / 2, belowY + size * 0.72);
  ctx.rotate(-0.035);
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#ff2e9e';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#ff8ad8';
  ctx.fillText(subtitle, 0, 0);
  ctx.restore();
  return belowY + size * 1.02;
}

function drawTaglineBar(ctx, width, height, tagline, belowY) {
  if (!tagline) return;
  const barH = Math.max(20, height * 0.034);
  const size = barH * 0.52;
  ctx.save();
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(2, size * 0.18)}px`;
  const textW = ctx.measureText(tagline).width;
  const barW = Math.min(width * 0.86, textW + barH * 2.4);
  const x = (width - barW) / 2;
  const y = belowY + height * 0.012;
  const skew = barH * 0.5;
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + barW, y);
  ctx.lineTo(x + barW - skew, y + barH);
  ctx.lineTo(x, y + barH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,2,26,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,130,0.8)';
  ctx.lineWidth = Math.max(1, height * 0.0012);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagline, width / 2, y + barH / 2 + size * 0.06);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Top strip: gold stars, review quote and gazette, VOL badge at the right.
function drawReviewStrip(ctx, width, height, state) {
  const cy = height * 0.03;
  const starR = height * 0.016;
  const stars = Math.max(0, Math.min(5, state.reviewStars || 5));
  let x = width * 0.028;
  ctx.save();
  ctx.fillStyle = '#ffd94d';
  for (let i = 0; i < stars; i += 1) {
    drawStar(ctx, x + starR, cy, starR, starR * 0.45);
    ctx.fill();
    x += starR * 2.4;
  }
  x += starR * 0.6;
  let quoteSize = height * 0.024;
  const badgeW = width * 0.075;
  const available = width - badgeW - x - width * 0.03;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const quote = `“${state.reviewQuote || ''}”`;
  const source = state.reviewSource ? ` — ${state.reviewSource}` : '';
  const measure = (size) => {
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
    const qw = ctx.measureText(quote).width;
    ctx.font = `${size * 0.82}px "Bebas Neue", sans-serif`;
    return qw + ctx.measureText(source).width + size;
  };
  while (quoteSize > height * 0.012 && measure(quoteSize) > available) quoteSize *= 0.94;
  ctx.font = `${quoteSize}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(quote, x, cy);
  const quoteW = ctx.measureText(quote).width;
  ctx.font = `${quoteSize * 0.82}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(source, x + quoteW + quoteSize * 0.5, cy);
  ctx.restore();

  if (state.volume) {
    const label = state.volume;
    const size = height * 0.021;
    ctx.save();
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
    const w = ctx.measureText(label).width + size * 1.4;
    const h = size * 1.7;
    const bx = width - width * 0.02 - w;
    const by = cy - h / 2;
    roundRectPath(ctx, bx, by, w, h, h * 0.22);
    ctx.fillStyle = '#ffd94d';
    ctx.fill();
    ctx.fillStyle = '#1c0b33';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + w / 2, by + h / 2 + size * 0.05);
    ctx.restore();
  }
}

// Gold starburst seal with the seal text running around its ring.
function drawSeal(ctx, width, height, text) {
  if (!text) return;
  const cx = width * 0.925;
  const cy = height * 0.775;
  const r = Math.min(width, height) * 0.052;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 40; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.86;
    const angle = (i * Math.PI) / 20 - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const gold = ctx.createLinearGradient(0, -r, 0, r);
  gold.addColorStop(0, '#ffe27a');
  gold.addColorStop(1, '#e8a91c');
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.strokeStyle = '#7a5200';
  ctx.lineWidth = r * 0.05;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#f7c948';
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,82,0,0.7)';
  ctx.lineWidth = r * 0.03;
  ctx.stroke();
  const ring = `${text} ★ ${text} ★`;
  const step = (Math.PI * 2) / ring.length;
  ctx.fillStyle = '#5c3a00';
  ctx.font = `${r * 0.19}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < ring.length; i += 1) {
    const angle = i * step - Math.PI / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, -r * 0.56);
    ctx.fillText(ring[i], 0, 0);
    ctx.restore();
  }
  drawStar(ctx, 0, 0, r * 0.34, r * 0.15);
  ctx.fillStyle = '#7a5200';
  ctx.fill();
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawBillingBlock(ctx, width, height, state) {
  const size = height * 0.017;
  ctx.save();
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, state.billing, width * 0.6);
  const startY = height * 0.925 - ((lines.length - 1) * size * 1.5) / 2;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * size * 1.5));
  if (state.showComingSoon) {
    ctx.font = `${height * 0.024}px "Bebas Neue", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${height * 0.004}px`;
    ctx.fillStyle = '#ff7ad9';
    ctx.textAlign = 'left';
    ctx.fillText('COMING SOON', width * 0.028, height * 0.962);
  }
  ctx.restore();
  drawBarcode(ctx, width, height, state.title);
}

function drawBarcode(ctx, width, height, seedText) {
  const rand = mulberry32(hashString(seedText || 'vice'));
  const w = width * 0.055;
  const h = height * 0.032;
  const x = width * 0.945 - w;
  const y = height * 0.932;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - w * 0.06, y - h * 0.12, w * 1.12, h * 1.55);
  ctx.fillStyle = '#111111';
  let bx = x;
  while (bx < x + w) {
    const bw = Math.max(1, width * 0.0009 * (1 + Math.floor(rand() * 3)));
    if (rand() > 0.35) ctx.fillRect(bx, y, bw, h);
    bx += bw + Math.max(1, width * 0.0006);
  }
  ctx.font = `${height * 0.012}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(100000 + Math.floor(rand() * 899999)), x + w / 2, y + h * 1.38);
  ctx.restore();
}

// Draw the whole poster onto ctx at the given pixel size.
export function drawPoster(ctx, width, height, state, photos) {
  const grade = GRADES[state.gradeId] ?? GRADES.sunset;
  drawBackdrop(ctx, width, height);
  drawSkyline(ctx, width, height);
  drawPalm(ctx, width * 0.015, height * 0.99, height * 0.085, 1);
  drawPalm(ctx, width * 0.985, height * 0.99, height * 0.075, -1);

  const cells = visibleCells(state, width, height);
  const rects = cells.map((cell) => cellRectPx(cell, width, height));
  const borderWidth = Math.max(1.5, width * 0.0013);
  const heroIndex = cells.findIndex((cell) => cell.hero);
  cells.forEach((cell, index) => {
    if (index === heroIndex && state.popoutHero) return;
    const panel = state.panels[index];
    if (!panel) return;
    drawPanel(ctx, rects[index], photos.get(panel.src), panel, grade, { borderWidth });
  });
  if (heroIndex >= 0 && state.panels[heroIndex]) {
    const panel = state.panels[heroIndex];
    drawPanel(ctx, rects[heroIndex], photos.get(panel.src), panel, grade, {
      scale: state.popoutHero ? 1.045 : 1,
      border: state.popoutHero ? 'rgba(255,255,255,0.95)' : 'rgba(255,214,130,0.9)',
      borderWidth: state.popoutHero ? Math.max(2, width * 0.002) : borderWidth,
      shadow: state.popoutHero ? width * 0.016 : 0,
    });
  }

  const title = drawChromeTitle(ctx, width, height, state.title, titleYFor(state, width, height) * height);
  const afterSubtitle = drawSubtitle(ctx, width, height, state.subtitle, title.bottom, title.size);
  drawTaglineBar(ctx, width, height, state.tagline, afterSubtitle);
  drawReviewStrip(ctx, width, height, state);
  drawSeal(ctx, width, height, state.sealText);
  drawBillingBlock(ctx, width, height, state);
}

// Render the poster to a fresh canvas at the requested pixel size.
export function renderPosterToCanvas(state, photos, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawPoster(canvas.getContext('2d'), width, height, state, photos);
  return canvas;
}

// Render the poster at one of the export sizes and return a PNG blob.
export async function exportPosterPNG(state, photos, sizeId) {
  await ensurePosterFonts();
  const size = EXPORT_SIZES[sizeId] ?? EXPORT_SIZES.wide;
  const canvas = renderPosterToCanvas(state, photos, size.width, size.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob, width: size.width, height: size.height };
}
