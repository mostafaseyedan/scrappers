import { NextRequest, NextResponse } from "next/server";
import { getById, patch, remove } from "@/lib/server/firebase";
import { getAuth } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/api";

type Params = {
  model: string;
  id: string;
  submodel: string;
  subid: string;
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const _params = await params;
  const { model, id, submodel, subid } = _params;
  const dbPath = `${model}/${id}/${submodel}`;
  let results: Record<string, any> = {};
  let status = 200;

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    await remove(dbPath, subid);
    results = { id: subid };
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
  const { model, id, submodel, subid } = _params;
  const dbPath = `${model}/${id}/${submodel}`;
  let results = {};
  let status = 200;

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    results = await getById(dbPath, subid);
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
  const { model, id, submodel, subid } = _params;
  const dbPath = `${model}/${id}/${submodel}`;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results: Record<string, any> = {};
  let status = 200;

  try {
    const tokens = await getAuth(req);
    if (!tokens) throw new Error("Not authenticated");

    results = await patch(dbPath, subid, updateData);
  } catch (error: any) {
    ({ status, results } = handleApiError(error));
  }

  return NextResponse.json(results, { status });
}
