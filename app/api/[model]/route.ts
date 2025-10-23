import { NextRequest, NextResponse } from "next/server";
import { count, get, parseQueryString, post } from "au/server/firebase";
import { checkSession as getAuth } from "@/lib/serverUtils";
import { handleApiError } from "@/lib/server/api";
import urlJoin from "url-join";

type Params = {
  model: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  let { model: dbPath } = _params;
  const queryOptions = parseQueryString(req.url);
  const parentDbPath = queryOptions?.parentDbPath || "";
  let results: Record<string, any> = { params: _params };
  let status = 200;

  dbPath = urlJoin(parentDbPath, dbPath);

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");
    results.records = await get(dbPath, queryOptions);
    results.totalRecords = await count(dbPath, queryOptions);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  let { model: dbPath } = _params;
  const { body } = req;
  const json = await new NextResponse(body).json();
  const parentDbPath = json.$parentDbPath || "";
  let results;
  let status = 200;
  const doc: Record<string, any> = {};

  dbPath = urlJoin(parentDbPath, dbPath);

  for (const key of Object.keys(json)) {
    if (!key.startsWith("$")) {
      doc[key] = json[key];
    }
  }

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    doc.authorId = tokens.uid;

    results = await post(dbPath, doc);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}
