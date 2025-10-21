import { NextRequest, NextResponse } from "next/server";
import { getById, parseQueryString, patch, remove } from "au/server/firebase";
import { checkSession as getAuth } from "@/lib/serverUtils";
import { handleApiError } from "@/lib/server/api";
import urlJoin from "url-join";

type Params = {
  model: string;
  id: string;
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  let { model: dbPath, id } = _params;
  const queryOptions = parseQueryString(req.url);
  const parentDbPath = queryOptions?.parentDbPath || "";
  let results: Record<string, any> = {};
  let status = 200;

  dbPath = urlJoin(parentDbPath, dbPath);

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    await remove(dbPath, id);
    results = { id };
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  let { model: dbPath, id } = _params;
  const queryOptions = parseQueryString(req.url);
  const parentDbPath = queryOptions?.parentDbPath || "";
  let results = {};
  let status = 200;

  dbPath = urlJoin(parentDbPath, dbPath);

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    results = await getById(dbPath, id);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  let { model: dbPath, id } = _params;
  const { body } = req;
  const json = await new NextResponse(body).json();
  const parentDbPath = json.$parentDbPath || "";
  const updateData: Record<string, any> = {};
  let results: Record<string, any> = {};
  let status = 200;

  dbPath = urlJoin(parentDbPath, dbPath);

  for (const key of Object.keys(json)) {
    if (!key.startsWith("$")) {
      updateData[key] = json[key];
    }
  }

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    results = await patch(dbPath, id, updateData);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}
