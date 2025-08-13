import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

// Firestore trigger: when a message doc is created under /messages/{documentId},
// copy uppercase version of its 'original' field into 'uppercase'
export const makeuppercase = onDocumentCreated(
  "/messages/{documentId}",
  (event) => {
    if (!event.data) {
      logger.warn("No event data found for document", event.params.documentId);
      return;
    }
    const original = event.data.data().original as unknown;
    logger.log("Uppercasing", event.params.documentId, original);

    if (typeof original !== "string") {
      logger.warn("Field 'original' is not a string; skipping uppercasing", {
        docId: event.params.documentId,
        type: typeof original,
      });
      return;
    }

    const uppercase = original.toUpperCase();
    return event.data.ref.set({ uppercase }, { merge: true });
  },
);
