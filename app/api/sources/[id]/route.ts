import { NextRequest, NextResponse } from "next/server";
import { getById, patch, put, remove as fireRemove } from "@/lib/firebaseAdmin";
import {
  remove as elasticRemove,
  patch as elasticPatch,
  post as elasticPost,
} from "@/lib/elastic";
import { checkSession } from "@/lib/serverUtils";
import { fireToJs } from "@/lib/dataUtils";

const COLLECTION = "sources";

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
    await fireRemove(COLLECTION, id);
    await elasticRemove(COLLECTION, id);
    results = { success: id };
  } catch (error) {
    if (String(error).includes('"result":"not_found"')) {
      // ignore not found in elastic search
    } else {
      console.error(`Failed to delete from ${COLLECTION} ${id}`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results = { error: errorMessage };
      status = 500;
    }
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
    results = await getById(COLLECTION, id);
  } catch (error) {
    console.error(`Failed to get from ${COLLECTION} ${id}`, error);
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
    await getById(COLLECTION, id);
    const updatedDoc = await patch(COLLECTION, id, updateData);

    const elasticDoc = fireToJs(updatedDoc);
    if (elasticDoc.name) elasticDoc.name_semantic = elasticDoc.name;
    if (elasticDoc.description)
      elasticDoc.description_semantic = elasticDoc.description;

    // If the elastic document is missing, create it
    await elasticPatch(COLLECTION, id, elasticDoc).catch(async (error) => {
      console.error(`Failed to update elastic for ${COLLECTION} ${id}`, error);

      if (error.message.includes("document_missing_exception")) {
        await elasticPost(COLLECTION, id, elasticDoc);
        console.log(`Elastic document created for ${COLLECTION} ${id}`);
      }
    });

    results = updatedDoc;
  } catch (error) {
    console.error(`Failed to update in ${COLLECTION} ${id}`, error);
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
    await getById(COLLECTION, id);
    const updatedDoc = await put(COLLECTION, id, updateData);

    const elasticDoc = fireToJs(updatedDoc);
    if (elasticDoc.name) elasticDoc.name_semantic = elasticDoc.name;
    if (elasticDoc.description)
      elasticDoc.description_semantic = elasticDoc.description;
    await elasticPatch(COLLECTION, id, elasticDoc);

    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update in ${COLLECTION} ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    status = 500;
    results = { error: errorMessage };
  }

  return NextResponse.json({ ...results }, { status });
}
