const UTF8_BOM = '\uFEFF';
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function neutralizeFormula(text) {
  return FORMULA_PREFIX_RE.test(text) ? `'${text}` : text;
}

function escapeCsvCell(value) {
  const text = neutralizeFormula(normalizeCellValue(value));
  const escaped = text.replace(/"/g, '""');
  return /[,"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function buildCsv(rows, fieldDefs) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  if (!Array.isArray(fieldDefs)) throw new TypeError('fieldDefs must be an array');

  const header = fieldDefs.map((field) => escapeCsvCell(field.label)).join(',');
  const body = rows.map((row) => (
    fieldDefs.map((field) => {
      const rawValue = row?.[field.key];
      const value = field.format ? field.format(rawValue) : rawValue;
      return escapeCsvCell(value);
    }).join(',')
  ));

  return `${UTF8_BOM}${[header].concat(body).join('\r\n')}`;
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let link = null;

  try {
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    if (link?.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }
}
