import { NextRequest, NextResponse } from "next/server";
import { getById, patch, remove } from "au/server/firebase";
import { getAuth } from "au/server/auth";
import { handleApiError } from "@/lib/server/api";

type Params = {
  model: string;
  id: string;
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  const { model: dbPath, id } = _params;
  let results: Record<string, any> = {};
  let status = 200;

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
  const { model: dbPath, id } = _params;
  let results = {};
  let status = 200;

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
  const { model: dbPath, id } = _params;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results: Record<string, any> = {};
  let status = 200;

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    results = await patch(dbPath, id, updateData);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}
