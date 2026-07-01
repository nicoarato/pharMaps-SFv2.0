import fs from 'node:fs/promises';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import Tesseract from 'tesseract.js';

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'docs/turnos-santa-fe-julio-2026.json';

if (!inputPath) {
  console.error('Usage: node scripts/ocr-turnos-santa-fe.mjs <pdf-path> [output-json]');
  process.exit(1);
}

async function renderFirstPage(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdf = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false
  }).promise;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    imageBuffer: canvas.toBuffer('image/png'),
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height)
  };
}

function normalizeText(text) {
  return (text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cropImage(image, width, height, region) {
  const x = Math.floor(width * region.x);
  const y = Math.floor(height * region.y);
  const w = Math.floor(width * region.w);
  const h = Math.floor(height * region.h);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  return canvas.toBuffer('image/png');
}

const resolvedInput = path.resolve(process.cwd(), inputPath);
const resolvedOutput = path.resolve(process.cwd(), outputPath);

const { imageBuffer, width, height } = await renderFirstPage(resolvedInput);
const image = await loadImage(imageBuffer);

const regions = [
  {
    id: 'santa-fe-1',
    label: 'Santa Fe col 1',
    x: 0.03,
    y: 0.12,
    w: 0.27,
    h: 0.82
  },
  {
    id: 'santa-fe-2',
    label: 'Santa Fe col 2',
    x: 0.28,
    y: 0.12,
    w: 0.27,
    h: 0.82
  },
  {
    id: 'santa-fe-3',
    label: 'Santa Fe col 3',
    x: 0.53,
    y: 0.12,
    w: 0.19,
    h: 0.82
  }
];

const blocks = [];

for (const region of regions) {
  const cropped = cropImage(image, width, height, region);
  const result = await Tesseract.recognize(cropped, 'spa');

  blocks.push({
    id: region.id,
    label: region.label,
    confidence: result.data.confidence,
    text: normalizeText(result.data.text)
  });
}

const payload = {
  source: resolvedInput,
  localidad: 'Santa Fe',
  rendered: { width, height },
  blocks
};

await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({
  source: resolvedInput,
  output: resolvedOutput,
  blocks: blocks.map(block => ({
    id: block.id,
    confidence: block.confidence,
    chars: block.text.length
  }))
}, null, 2));
