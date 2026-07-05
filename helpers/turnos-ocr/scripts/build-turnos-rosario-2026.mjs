import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2] || 'docs/extracted-turnero-2026.json';
const outputPath = process.argv[3] || '../../src/assets/data/turnos-rosario-2026.json';

const MONTHS = [
  { label: 'Enero', month: '01' },
  { label: 'Febrero', month: '02' },
  { label: 'Marzo', month: '03' },
  { label: 'Abril', month: '04' },
  { label: 'Mayo', month: '05' },
  { label: 'Junio', month: '06' },
  { label: 'Julio', month: '07' },
  { label: 'Agosto', month: '08' },
  { label: 'Septiembre', month: '09' },
  { label: 'Octubre', month: '10' },
  { label: 'Noviembre', month: '11' },
  { label: 'Diciembre', month: '12' }
];

function normalizeText(value) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:/])/g, '$1')
    .trim();
}

function groupRows(page, tolerance = 4) {
  const rows = [];

  for (const item of page.items) {
    const row = rows.find(candidate => Math.abs(candidate.y - item.y) < tolerance);

    if (row) {
      row.items.push(item);
      row.y = Math.max(row.y, item.y);
      continue;
    }

    rows.push({ y: item.y, items: [item] });
  }

  return rows
    .map(row => ({
      y: row.y,
      items: row.items.sort((a, b) => a.x - b.x),
      text: normalizeText(row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
    }))
    .sort((a, b) => b.y - a.y);
}

function extractTurnNumber(page) {
  const text = page.items.map(item => item.text).join(' ');
  const match = text.match(/FARMACIAS\s+DE\s+TURNO\s+N[º°]?\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseSection(text) {
  const normalized = normalizeText(text)
    .replace(/\s+º/g, 'º')
    .replace(/\s+°/g, '°');

  if (!normalized) {
    return '';
  }

  return normalized;
}

function parseDutyPage(page) {
  const turnoNumero = extractTurnNumber(page);
  const rows = groupRows(page);
  const farmacias = [];
  let currentSection = '';
  let inDutyBlock = false;

  for (const row of rows) {
    if (/^SECCION\s+FARMACIA\s+DIRECCIONES$/i.test(row.text)) {
      inDutyBlock = true;
      continue;
    }

    if (!inDutyBlock) {
      continue;
    }

    if (/FARMACIAS\s+ABIERTAS\s+LAS\s+24\s+HORAS/i.test(row.text)) {
      break;
    }

    if (/NOMINA\s+PROVISTA/i.test(row.text)) {
      break;
    }

    const section = parseSection(row.items
      .filter(item => item.x < 145)
      .map(item => item.text)
      .join(' '));
    const name = normalizeText(row.items
      .filter(item => item.x >= 145 && item.x < 295)
      .map(item => item.text)
      .join(' '));
    const address = normalizeText(row.items
      .filter(item => item.x >= 295)
      .map(item => item.text)
      .join(' '));

    if (section) {
      currentSection = section;
    }

    if (!name || !address) {
      continue;
    }

    farmacias.push({
      seccion: currentSection,
      nombre: name,
      direccion: address,
      telefono: ''
    });
  }

  return {
    turnoNumero,
    turno: `TURNO ${String(turnoNumero).padStart(2, '0')}`,
    farmacias
  };
}

function nearestTurno(x, columns) {
  return columns.reduce((nearest, column) => {
    const currentDistance = Math.abs(column.x - x);
    const nearestDistance = Math.abs(nearest.x - x);
    return currentDistance < nearestDistance ? column : nearest;
  });
}

function parseCalendar(page) {
  const rows = groupRows(page);
  const header = rows.find(row => row.text.includes('MES/TURNO'));
  const columns = header.items
    .filter(item => /^\d+$/.test(item.text))
    .map(item => ({ turnoNumero: Number(item.text), x: item.x }));
  const monthRows = [];

  for (const month of MONTHS) {
    const labelRow = rows.find(row => row.items.some(item => item.text === month.label));

    if (!labelRow) {
      throw new Error(`No se encontro el mes ${month.label} en el calendario.`);
    }

    monthRows.push({
      ...month,
      rows: rows.filter(row =>
        Math.abs(row.y - labelRow.y) <= 15 &&
        row.items.some(item => item.x > 120 && /^\d+$/.test(item.text))
      )
    });
  }

  const turnosPorNumero = new Map(columns.map(column => [column.turnoNumero, []]));
  const calendario = [];

  for (const month of monthRows) {
    for (const row of month.rows) {
      for (const item of row.items) {
        if (!/^\d+$/.test(item.text)) {
          continue;
        }

        const day = Number(item.text);
        const column = nearestTurno(item.x, columns);
        const fecha = `2026-${month.month}-${String(day).padStart(2, '0')}`;
        const rango = {
          desde: `${fecha}T08:00:00-03:00`,
          hasta: nextDayRangeEnd(fecha)
        };

        calendario.push({
          fecha,
          turnoNumero: column.turnoNumero,
          turno: `TURNO ${String(column.turnoNumero).padStart(2, '0')}`,
          rango
        });
        turnosPorNumero.get(column.turnoNumero).push(rango);
      }
    }
  }

  calendario.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    calendario,
    turnosPorNumero
  };
}

function nextDayRangeEnd(fecha) {
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}T08:00:00-03:00`;
}

const resolvedInput = path.resolve(process.cwd(), inputPath);
const resolvedOutput = path.resolve(process.cwd(), outputPath);
const extracted = JSON.parse(await fs.readFile(resolvedInput, 'utf8'));
const { calendario, turnosPorNumero } = parseCalendar(extracted.pages[0]);
const turnos = extracted.pages
  .slice(1)
  .map(parseDutyPage)
  .filter(turno => turno.turnoNumero)
  .sort((a, b) => a.turnoNumero - b.turnoNumero)
  .map(turno => ({
    ...turno,
    rangos: turnosPorNumero.get(turno.turnoNumero) || []
  }));

const fuente = {
  tipo: 'pdf',
  fechaReferencia: '2026',
  nota: `Extraido desde ${path.basename(extracted.source || resolvedInput)} mediante pdfjs. Rango horario: 08:00 del dia seleccionado a 08:00 del dia siguiente.`
};

const payload = [{
  localidad: 'Rosario',
  mes: '2026',
  turnos: turnos.map(({ turnoNumero, turno, rangos, farmacias }) => ({
    turno,
    turnoNumero,
    rangos,
    farmacias
  })),
  calendario,
  fuente
}];

await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`);

console.log(JSON.stringify({
  output: resolvedOutput,
  calendario: calendario.length,
  turnos: payload[0].turnos.length,
  farmacias: turnos.reduce((total, turno) => total + turno.farmacias.length, 0),
  farmaciasPorTurno: payload[0].turnos.map(turno => ({
    turnoNumero: turno.turnoNumero,
    farmacias: turno.farmacias.length,
    rangos: turno.rangos.length
  }))
}, null, 2));
