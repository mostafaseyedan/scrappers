import { NextRequest, NextResponse } from "next/server";
import { get, getById, patch, post } from "@/lib/firebaseAdmin";
import { patch as elasticPatch } from "@/lib/elastic";
import { checkSession } from "@/lib/serverUtils";

const COLLECTION = "solicitations";
const SUBCOLLECTION = "logs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");
    if (!id) throw new Error("ID is required");

    const normalizedDocs = await get(`${COLLECTION}/${id}/${SUBCOLLECTION}`);
    results = { results: normalizedDocs };
  } catch (error) {
    console.error(`Error fetching from ${SUBCOLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");
    if (!id) throw new Error("ID is required");

    const sol = await getById(COLLECTION, id);
    if (!sol) throw new Error(`Parent record from ${COLLECTION} not found`);

    //const countData = { commentsCount: (sol.commentsCount || 0) + 1 };
    //await patch(COLLECTION, id, { ...countData });
    //await elasticPatch(COLLECTION, id, { ...countData });

    results =
      (await post(`${COLLECTION}/${id}/${SUBCOLLECTION}`, updateData, user)) ||
      {};
  } catch (error) {
    console.error(`Error creating in ${SUBCOLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
