import "dotenv/config";
import { initDb } from "../../lib/firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";

const db = initDb();

function fixUrl(url: string): string {
  // Normalize findrfp URLs so that result.aspx lives under /service/ and ensure missing slash is handled.
  // Examples:
  // - https://www.findrfp.comresult.aspx?...   -> https://www.findrfp.com/service/result.aspx?...
  // - https://www.findrfp.com/result.aspx?...  -> https://www.findrfp.com/service/result.aspx?...
  // - https://www.findrfp.com/service/result.aspx?... -> unchanged
  return url.replace(
    /^(https?:\/\/(?:www\.)?findrfp\.com)(?:\/)?(?!service\/)result\.aspx/i,
    "$1/service/result.aspx"
  );
}

async function main() {
  const commit = process.argv.includes("--commit");
  const pageSize = 500;
  let lastId: string | null = null;
  let checked = 0;
  let updated = 0;
  let batchesCommitted = 0;

  console.log(
    `Scanning Firestore for site=="findrfp" to normalize siteUrl to /service/result.aspx...`
  );
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN"}`);

  while (true) {
    let q = db
      .collection("solicitations")
      .where("site", "==", "findrfp")
      .orderBy(FieldPath.documentId())
      .limit(pageSize);

    if (lastId) q = q.startAfter(lastId);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchOps = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as any;
      const url = data?.siteUrl;
      checked++;

      if (typeof url === "string") {
        const corrected = fixUrl(url);
        if (corrected !== url) {
          updated++;
          console.log(`Fix ${doc.id}: ${url} -> ${corrected}`);
          if (commit) {
            batch.update(doc.ref, { siteUrl: corrected });
            batchOps++;
          }
        }
      }
    }

    if (commit && batchOps > 0) {
      await batch.commit();
      batchesCommitted++;
      console.log(
        `Committed batch with ${batchOps} updates (total batches: ${batchesCommitted}).`
      );
    }

    lastId = snap.docs[snap.docs.length - 1].id;
  }

  console.log(`\nChecked: ${checked}`);
  console.log(`Would update: ${updated}${commit ? " (applied)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
