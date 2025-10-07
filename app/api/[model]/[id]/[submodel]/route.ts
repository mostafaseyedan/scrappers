import { NextRequest, NextResponse } from "next/server";
import { count, get, parseQueryString, post } from "au/server/firebase";
import { getAuth } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/api";

type Params = {
  model: string;
  id: string;
  submodel: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  const { model, id, submodel } = _params;
  const dbPath = `${model}/${id}/${submodel}`;
  const queryOptions = parseQueryString(req.url);
  let results: Record<string, any> = { params: _params };
  let status = 200;

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
  const { model, id, submodel } = _params;
  const dbPath = `${model}/${id}/${submodel}`;
  const { body } = req;
  const doc = await new NextResponse(body).json();
  let results;
  let status = 200;

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    doc.authorId = tokens.decodedToken.uid;

    results = await post(dbPath, doc);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}
