import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const db = initDb();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);

async function isITBid(record: any): Promise<boolean> {
  const prompt = `
Given the following bid record, is it related to any of the following categories: IT, IT staffing, software services, or managed services? 
Respond with "yes" or "no" and a short explanation.

Record:
${record}
`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().toLowerCase();
  console.log({ text });
  return text.includes("yes");
}

async function main() {
  const snapshot = await db.collection("solicitations").limit(30).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const isIT = await isITBid(data);
    console.log(`Doc ${doc.id}: ${isIT ? "IT-related" : "Not IT-related"}`);
    // Optionally, update Firestore or take other actions here
  }
}

main().catch(console.error);
