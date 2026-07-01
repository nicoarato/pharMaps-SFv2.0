import fs from 'node:fs/promises';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import Tesseract from 'tesseract.js';

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'docs/ocr-turnos-output.json';

if (!inputPath) {
  console.error('Usage: node scripts/ocr-turnos-pdf.mjs <pdf-path> [output-json]');
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
    .replace(/\s+/g, ' ')
    .trim();
}

function sortWords(words) {
  return words
    .filter(word => normalizeText(word.text).length > 0)
    .map(word => ({
      text: normalizeText(word.text),
      x0: word.bbox.x0,
      x1: word.bbox.x1,
      y0: word.bbox.y0,
      y1: word.bbox.y1
    }))
    .sort((a, b) => {
      if (Math.abs(a.y0 - b.y0) > 10) {
        return a.y0 - b.y0;
      }
      return a.x0 - b.x0;
    });
}

function buildRows(words) {
  const rows = [];

  for (const word of words) {
    const row = rows.find(candidate => Math.abs(candidate.y - word.y0) < 12);
    if (row) {
      row.words.push(word);
      row.y = Math.min(row.y, word.y0);
      continue;
    }

    rows.push({ y: word.y0, words: [word] });
  }

  return rows
    .map(row => ({
      y: row.y,
      text: row.words
        .sort((a, b) => a.x0 - b.x0)
        .map(word => word.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    }))
    .sort((a, b) => a.y - b.y);
}

const resolvedInput = path.resolve(process.cwd(), inputPath);
const resolvedOutput = path.resolve(process.cwd(), outputPath);
const { imageBuffer, width, height } = await renderFirstPage(resolvedInput);

const result = await Tesseract.recognize(imageBuffer, 'spa', {
  tessjs_create_tsv: '1',
  tessjs_create_hocr: '1'
});

const tsvRows = (result.data.tsv || '')
  .split('\n')
  .slice(1)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const parts = line.split('\t');
    if (parts.length < 12) {
      return null;
    }

    return {
      level: Number(parts[0]),
      page_num: Number(parts[1]),
      block_num: Number(parts[2]),
      par_num: Number(parts[3]),
      line_num: Number(parts[4]),
      word_num: Number(parts[5]),
      left: Number(parts[6]),
      top: Number(parts[7]),
      width: Number(parts[8]),
      height: Number(parts[9]),
      conf: Number(parts[10]),
      text: normalizeText(parts.slice(11).join('\t'))
    };
  })
  .filter(Boolean);

const words = sortWords(
  tsvRows
    .filter(row => row.level === 5 && row.text.length > 0)
    .map(row => ({
      text: row.text,
      bbox: {
        x0: row.left,
        y0: row.top,
        x1: row.left + row.width,
        y1: row.top + row.height
      }
    }))
);

const rows = buildRows(words);

const payload = {
  source: resolvedInput,
  rendered: { width, height },
  confidence: result.data.confidence,
  previewText: normalizeText(result.data.text).slice(0, 8000),
  hocrPreview: (result.data.hocr || '').slice(0, 4000),
  tsvRows,
  words,
  rows
};

await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({
  source: resolvedInput,
  output: resolvedOutput,
  confidence: result.data.confidence,
  rows: rows.length,
  words: words.length
}, null, 2));
