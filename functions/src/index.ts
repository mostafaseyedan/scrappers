import { setGlobalOptions, logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

setGlobalOptions({ maxInstances: 10 });

initializeApp();
// Avoid failing writes when fields are undefined; we still validate inputs below.
getFirestore().settings({ ignoreUndefinedProperties: true });

// Take the text parameter passed to this HTTP endpoint and insert it into
// Firestore under the path /messages/:documentId/original
exports.addmessage = onRequest(async (req, res) => {
  // Grab the text parameter.
  const q = req.query.text;
  const original = Array.isArray(q) ? q[0] : q;

  if (typeof original !== "string" || original.trim().length === 0) {
    res.status(400).json({ error: "Missing required query param 'text'" });
    return;
  }

  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await getFirestore()
    .collection("testmessages")
    .add({ original });
  // Send back a message that we've successfully written the message
  res.json({ result: `Message with ID: ${writeResult.id} added.` });
});

// Listens for new messages added to /messages/:documentId/original
// and saves an uppercased version of the message
// to /messages/:documentId/uppercase
exports.makeuppercase = onDocumentCreated("/messages/{documentId}", (event) => {
  // Grab the current value of what was written to Firestore.
  if (!event.data) {
    logger.warn("No event data found for document", event.params.documentId);
    return;
  }
  const original = event.data.data().original as unknown;

  // Access the parameter `{documentId}` with `event.params`
  logger.log("Uppercasing", event.params.documentId, original);

  if (typeof original !== "string") {
    logger.warn("Field 'original' is not a string; skipping uppercasing", {
      docId: event.params.documentId,
      type: typeof original,
    });
    return;
  }

  const uppercase = original.toUpperCase();

  // You must return a Promise when performing
  // asynchronous tasks inside a function
  // such as writing to Firestore.
  // Setting an 'uppercase' field in Firestore document returns a Promise.
  return event.data.ref.set({ uppercase }, { merge: true });
});
