export type ExportFormat = 'png' | 'jpg';

const pad = (n: number) => String(n).padStart(2, '0');

/** splitframe-YYYYMMDD-HHmm.png (or .jpg), in local time (FR-034); `prefix` replaces "splitframe". */
export function exportFilename(date: Date, format: ExportFormat, prefix = 'splitframe'): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${prefix}-${day}-${time}.${format}`;
}
