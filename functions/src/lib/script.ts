import { sanitizeDateString } from "./utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { solicitation as solModel } from "../models";

const genAI = new GoogleGenerativeAI(process.env.DEV_GEMINI_KEY!);

export function isNotExpired(record: Record<string, any>): boolean {
  if (!record.closingDate) return false;

  const closingDate = sanitizeDateString(record.closingDate);
  if (!closingDate) return false;

  const now = new Date();
  const closing = new Date(closingDate);

  return closing.getTime() < now.getTime() + 60 * 60 * 24 * 3;
}

export async function isItRelated(
  record: Record<string, any>
): Promise<boolean> {
  const prompt = `
Given the following bid record, is it related to any of the following categories: ERP Consulting, ERP Upgrades, ERP Implementation, ERP Migration, ERP Integration, Infor Support ,Infor Consulting, Infor Managed Services, Infor CloudSuite Implementation, CloudSuite Implementation, Lawson Consulting, Lawson Managed Services, Workday HCM, Workday Migration, PeopleSoft Services, PeopleSoft Migration, PeopleSoft Support, Oracle ERP, PeopleSoft Services, IT Staffing, IT Services, IT Support, Information Technology Consulting, Managed IT services, System Modernization, Oracle Support, or Oracle Database Managed Services in the USA? 
Respond with yes or no

Record:
${JSON.stringify(record)}`; // and a short explanation

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().toLowerCase();

  return text === "yes";
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
  });
  return respCheck.results?.length > 0;
}
