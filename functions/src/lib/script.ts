import { sanitizeDateString } from "./utils";
import { solicitation as solModel } from "../models";

export function isNotExpired(record: Record<string, any>): boolean {
  if (!record.closingDate) return false;

  const closingDate = sanitizeDateString(record.closingDate);
  if (!closingDate) return false;

  const now = new Date();
  const closing = new Date(closingDate);

  return closing.getTime() > now.getTime() + 60 * 60 * 24 * 3 * 1000; // 3 days
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const date = sanitizeDateString(dateStr);
  if (!date) return false;

  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = Math.abs(targetDate.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= days;
}

export async function isSolDuplicate(
  sol: Record<string, any>,
  baseUrl: string,
  serviceKey: string
) {
  const respCheck = await solModel.get({
    baseUrl,
    filters: { siteId: sol.siteId },
    token: serviceKey,
    includeNonRelevant: true, // Include nonRelevant to prevent re-scraping
  });
  return respCheck.results?.length > 0;
}
