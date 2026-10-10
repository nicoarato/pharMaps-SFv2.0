import fs from 'node:fs/promises';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';

const [input, output = 'turnos-report/santa-fe-ocr'] = process.argv.slice(2);
if (!input) throw new Error('Uso: node extract-santa-fe.mjs archivo.pdf carpeta-salida');
await fs.mkdir(output, { recursive: true });
const pdf = await pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(input)), isEvalSupported: false, useSystemFonts: true }).promise;
if (pdf.numPages !== 1) throw new Error('Formato inesperado: se esperaba un afiche de una página');
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 3 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
await fs.writeFile(path.join(output, 'page.png'), canvas.toBuffer('image/png'));
const image = await loadImage(canvas.toBuffer('image/png'));
function crop(region, threshold = false) {
  const x = Math.round(canvas.width * region.x), y = Math.round(canvas.height * region.y);
  const width = Math.round(canvas.width * region.w), height = Math.round(canvas.height * region.h);
  const c = createCanvas(width, height), ctx = c.getContext('2d');
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  if (threshold) {
    const pixels = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const v = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3 < 165 ? 0 : 255;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return c.toBuffer('image/png');
}
async function inkBands(buffer) {
  const img = await loadImage(buffer), c = createCanvas(img.width, img.height), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const bands = []; let start = null, last = null;
  for (let y = 165; y < c.height * .94; y++) {
    let count = 0;
    for (let x = Math.floor(c.width * .03); x < c.width * .36; x++) {
      const i = (y * c.width + x) * 4;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 100) count++;
    }
    if (count >= 8) { start ??= y; last = y; }
    else if (start !== null && y - last > 4) {
      if (last - start >= 12) bands.push({ y0: start, y1: last });
      start = null; last = null;
    }
  }
  if (start !== null && last - start >= 12) bands.push({ y0: start, y1: last });
  return bands;
}
const worker = await createWorker('spa', 1, { cachePath: process.env.OCR_CACHE || output });
async function recognize(buffer, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '1' });
  const { data } = await worker.recognize(buffer, {}, { text: true, blocks: true });
  return { text: data.text, confidence: data.confidence,
    lines: (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines.map(l => ({
      text: l.text, confidence: l.confidence, bbox: l.bbox,
      words: l.words.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox }))
    })))) };
}
const report = { source: input, pages: pdf.numPages, rendered: { width: canvas.width, height: canvas.height }, blocks: [] };
try {
  report.header = await recognize(crop({ x: .435, y: .104, w: .51, h: .052 }), 6);
  report.locality = await recognize(crop({ x: .225, y: .181, w: .32, h: .035 }), 6);
  await fs.writeFile(path.join(output, 'header.png'), crop({ x: .435, y: .104, w: .51, h: .052 }));
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const id = row * 3 + col + 1;
    const region = { x: [.048, .270, .493][col], y: [.237, .414, .590, .767][row], w: .200, h: .158 };
    const original = crop(region), binary = crop(region, true);
    await fs.writeFile(path.join(output, `turno-${id}.png`), original);
    const readings = [];
    for (const [label, buffer, psm] of [['original', original, 6], ['binarizado', binary, 6], ['disperso', original, 11]]) {
      readings.push({ method: label, ...await recognize(buffer, psm) });
    }
    report.blocks.push({ id, region, image: `turno-${id}.png`, inkBands: await inkBands(original), readings });
    console.log(`Turno ${id}: ${readings.map(r => `${r.method}=${r.confidence}`).join(', ')}`);
  }
} finally { await worker.terminate(); }
await fs.writeFile(path.join(output, 'ocr.json'), JSON.stringify(report, null, 2) + '\n');
