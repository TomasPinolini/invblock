/**
 * Client-side CSV download utility.
 * Adds UTF-8 BOM so Excel opens it correctly.
 */

function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][]
) {
  const bom = "\uFEFF";
  const csv =
    headers.map(escapeCell).join(",") +
    "\n" +
    rows.map((row) => row.map(escapeCell).join(",")).join("\n");

  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
