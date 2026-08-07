type CsvCell = string | number | boolean | null | undefined;

const protectSpreadsheetCell = (value: CsvCell) => {
  const text = value == null ? "" : String(value);
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
};

export function createExcelCompatibleCsv(rows: CsvCell[][]): string {
  return `\uFEFF${rows
    .map((row) => row.map(protectSpreadsheetCell).join(";"))
    .join("\r\n")}`;
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const blob = new Blob([createExcelCompatibleCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function isDateWithinRange(
  value: string,
  from: string,
  to: string,
): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const key = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return key >= from && key <= to;
}
