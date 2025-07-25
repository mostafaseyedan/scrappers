import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function randomString(length: number): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function sanitizeDateString(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  return date.toISOString();
}

export function sanitizeUniqueCommaValues(
  input: string | string[] | undefined
): string[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : input.split(",");
  const sanitized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(sanitized)).sort();
}
