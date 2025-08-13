import { onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

// HTTP function: adds a message with query param `text` into testmessages collection
export const addmessage = onRequest(async (req, res) => {
  const q = req.query.text;
  const original = Array.isArray(q) ? q[0] : q;

  if (typeof original !== "string" || original.trim().length === 0) {
    res.status(400).json({ error: "Missing required query param 'text'" });
    return;
  }

  const writeResult = await db.collection("testmessages").add({ original });
  res.json({ result: `Message with ID: ${writeResult.id} added.` });
});
