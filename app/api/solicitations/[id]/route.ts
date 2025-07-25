import { NextRequest, NextResponse } from "next/server";
import { fireToJs } from "@/lib/dataUtils";
import { getById, patch, put, remove as fireRemove } from "@/lib/firebaseAdmin";
import { remove as elasticRemove, patch as elasticPatch } from "@/lib/elastic";
import { checkSession } from "@/lib/serverUtils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");
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
    const doc = await getById("solicitations", id);
    results = doc;
  } catch (error) {
    console.error(`Failed to get solicitation ${id}`, error);
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
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results;
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");
    await getById("solicitations", id);
    const updatedDoc = await patch("solicitations", id, updateData);
    await elasticPatch("solicitations", id, fireToJs(updateData));
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
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");
    await getById("solicitations", id);
    const updatedDoc = await put("solicitations", id, updateData);
    await elasticPatch("solicitations", id, fireToJs(updateData));
    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    status = 500;
    results = { error: errorMessage };
  }

  return NextResponse.json({ ...results }, { status });
}
