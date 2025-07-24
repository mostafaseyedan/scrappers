import { NextRequest, NextResponse } from "next/server";
import { fbToJs } from "@/lib/dataUtils";
import { getById, patch, put, remove as fireRemove } from "@/lib/firebaseAdmin";
import { remove as elasticRemove, patch as elasticPatch } from "@/lib/elastic";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import { authConfig } from "@/config/serverConfig";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokens = await getTokens(await cookies(), authConfig);
  let results = {};
  let status = 200;

  try {
    if (!tokens) throw new Error("Unauthenticated");
    await fireRemove("solicitations", id);
    await elasticRemove("solicitations", id);
    results = { success: id };
  } catch (error) {
    console.error(`Failed to delete solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokens = await getTokens(await cookies(), authConfig);
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results;
  let status = 200;

  try {
    if (!tokens) throw new Error("Unauthenticated");
    await getById("solicitations", id);
    const updatedDoc = await patch("solicitations", id, updateData);
    await elasticPatch("solicitations", id, fbToJs(updateData));
    results = updatedDoc;
  } catch (error) {
    console.error(`Failed to update solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json(results, { status });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokens = await getTokens(await cookies(), authConfig);
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results = {};
  let status = 200;

  try {
    if (!tokens) throw new Error("Unauthenticated");
    await getById("solicitations", id);
    const updatedDoc = await put("solicitations", id, updateData);
    await elasticPatch("solicitations", id, fbToJs(updateData));
    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    status = 500;
    results = { error: errorMessage };
  }

  return NextResponse.json({ ...results }, { status });
}
