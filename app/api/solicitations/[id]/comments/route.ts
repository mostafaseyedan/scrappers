import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@/config/serverConfig";
import { get, getById, patch, post } from "@/lib/firebaseAdmin";
import { patch as elasticPatch } from "@/lib/elastic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokens = await getTokens(await cookies(), authConfig);
  let results = {};
  let status = 200;

  try {
    if (!tokens) throw new Error("Unauthenticated");
    if (!id) throw new Error("ID is required");

    const normalizedDocs = await get(`solicitations/${id}/comments`);
    results = { results: normalizedDocs };
  } catch (error) {
    console.error("Error fetching comment", error);
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
  const tokens = await getTokens(await cookies(), authConfig);
  const user = tokens?.decodedToken;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results = {};
  let status = 200;

  try {
    if (!tokens) throw new Error("Unauthenticated");
    if (!user || !user.uid) throw new Error("User not found");
    if (!id) throw new Error("ID is required");

    const sol = await getById("solicitations", id);
    if (!sol) throw new Error("Solicitation not found");

    const countData = { commentsCount: (sol.commentsCount || 0) + 1 };
    await patch("solicitations", id, { ...countData });
    await elasticPatch("solicitations", id, { ...countData });

    results =
      (await post(`solicitations/${id}/comments`, updateData, user)) || {};
  } catch (error) {
    console.error("Error creating new comment", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
