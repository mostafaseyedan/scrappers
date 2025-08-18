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

export function sanitizeDateString(dateString: string): string | null {
  if (!dateString) return null;

  let date;

  try {
    date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(
        `Failed to parse date string: ${dateString}. Invalid date format`,
      );
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.warn(`Failed to parse date string: ${dateString}`, "\n", error);
    date = null;
  }

  return null;
}

export function sanitizeUniqueCommaValues(
  input: string | string[] | undefined,
): string[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : input.split(",");
  const sanitized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(sanitized)).sort();
}

// seconds to time string in format hh:mm:ss
export function secToTimeStr(seconds: number): string {
  if (seconds < 0) return "00:00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(secs).padStart(2, "0")}`;
}

export async function uidsToNames(
  uids: string[] = [],
  getUser: (uid: string) => Promise<Record<string, any> | undefined>,
): Promise<string[]> {
  return Promise.all(
    uids.map(async (uid: string): Promise<string> => {
      if (getUser && uid) {
        const user = await getUser(uid);
        return user ? user.displayName || user.email || uid : uid;
      }
      return uid;
    }),
  );
}
