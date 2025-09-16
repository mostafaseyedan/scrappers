import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { initDb, normalizeDoc, parseQueryString } from "@/lib/firebaseAdmin";

const COLLECTION = "solicitations";
const db = initDb();

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  const queryOptions = parseQueryString(req.url);
  let results = {};
  let status = 200;
  const limit = parseInt(queryOptions.limit) || 50;

  try {
    if (!user) throw new Error("Unauthenticated");

    const dbCol = db.collectionGroup("logs");
    const query = dbCol.orderBy("created", "desc").limit(limit);
    const snapshot = await query.get();
    const logs = snapshot.docs
      .filter((doc) => doc.ref.parent.path.split("/")[0] === COLLECTION)
      .map((doc) => ({
        id: doc.id,
        ...normalizeDoc(doc),
        _collection: doc.ref.parent.path.split("/")[0],
      }));

    results = { results: logs };
  } catch (error) {
    console.error(`Failed to get ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
