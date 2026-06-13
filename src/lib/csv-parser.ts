// Minimal RFC-4180-ish CSV parser. Supports quoted fields with embedded
// commas / newlines / double-quote escapes. Pure, no deps.

export interface ParsedRow {
  rowNumber: number; // 1-indexed, header is row 1, first data row is 2
  raw: Record<string, string>;
}

export function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const records = tokenize(text);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    // Skip fully-empty trailing line
    if (cells.length === 1 && cells[0] === "") continue;
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? "").trim();
    });
    rows.push({ rowNumber: i + 1, raw });
  }
  return { headers, rows };
}

function tokenize(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        out.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // ignore; \n will close the row
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    out.push(row);
  }
  return out;
}
