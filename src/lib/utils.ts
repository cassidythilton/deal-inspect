import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Domo fiscal calendar: Feb–Jan
 *   FQ1 = Feb, Mar, Apr
 *   FQ2 = May, Jun, Jul
 *   FQ3 = Aug, Sep, Oct
 *   FQ4 = Nov, Dec, Jan
 *
 * January belongs to the previous calendar year's fiscal year.
 */
export function getFiscalQuarter(date: Date = new Date()): { year: number; quarter: number; label: string } {
  const month = date.getMonth(); // 0-indexed
  const calYear = date.getFullYear();
  const adjusted = (month + 11) % 12; // shift so Feb=0
  const quarter = Math.floor(adjusted / 3) + 1;
  const fiscalYear = month === 0 ? calYear - 1 : calYear;
  return { year: fiscalYear, quarter, label: `${fiscalYear}-Q${quarter}` };
}

/** Build a window of N fiscal quarters starting from the current one. */
export function getFiscalQuarterWindow(count: number): string[] {
  const { year, quarter } = getFiscalQuarter();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    let q = quarter + i;
    let y = year;
    while (q > 4) { q -= 4; y++; }
    labels.push(`${y}-Q${q}`);
  }
  return labels;
}
