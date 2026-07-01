import fs from 'node:fs/promises';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node scripts/extract-turnos-pdf.mjs <pdf-path>');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), inputPath);
const data = new Uint8Array(await fs.readFile(resolvedPath));

const loadingTask = pdfjs.getDocument({
  data,
  useSystemFonts: true,
  isEvalSupported: false
});

const pdf = await loadingTask.promise;
const pages = [];

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const items = textContent.items
    .filter(item => item && typeof item.str === 'string')
    .map(item => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0),
      height: Number(item.height || 0)
    }))
    .filter(item => item.text.length > 0);

  pages.push({
    pageNumber,
    width: page.view[2],
    height: page.view[3],
    items
  });
}

console.log(JSON.stringify({
  source: resolvedPath,
  pageCount: pdf.numPages,
  pages
}, null, 2));
