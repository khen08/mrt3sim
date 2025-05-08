import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and merges them with tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format filename by removing everything before the first underscore
 * Example: "2025-05-06-22-47-29_04-12_peak_only.csv" -> "04-12_peak_only.csv"
 */
export function formatFileName(filename: string | null): string | null {
  if (!filename) return filename;

  const underscoreIndex = filename.indexOf("_");
  if (underscoreIndex === -1) return filename;

  return filename.slice(underscoreIndex + 1);
}
