import { NextRequest, NextResponse } from "next/server";
import { fireToJs } from "@/lib/dataUtils";
import { getById, patch, put, remove as fireRemove } from "@/lib/firebaseAdmin";
import {
  remove as elasticRemove,
  patch as elasticPatch,
  post as elasticPost,
} from "@/lib/elastic";
import { checkSession } from "@/lib/serverUtils";
import { solicitation_log as solLogModel } from "@/app/models";

const COLLECTION = "solicitations";

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
    console.error(`Failed to delete from ${COLLECTION} ${id}`, error);
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
    const doc = await getById(COLLECTION, id);
    results = doc;
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

  if (updateData.cnStatus === "notPursuing") updateData.cnType = "nonRelevant";
  if (updateData.publishDate === "") updateData.publishDate = null;
  if (updateData.closingDate === "") updateData.closingDate = null;

  try {
    if (!user) throw new Error("Unauthenticated");
    await getById(COLLECTION, id);
    const updatedDoc = await patch(COLLECTION, id, updateData);
    const elasticDoc = fireToJs(updatedDoc);
    if (elasticDoc.title) elasticDoc.title_semantic = elasticDoc.title;
    if (elasticDoc.description)
      elasticDoc.description_semantic = elasticDoc.description;

    if (elasticDoc.publishDate === "") elasticDoc.publishDate = null;
    if (elasticDoc.closingDate === "") elasticDoc.closingDate = null;

    // If the elastic document is missing, create it
    await elasticPatch(COLLECTION, id, elasticDoc).catch(async (error) => {
      console.error(`Failed to update elastic for ${COLLECTION} ${id}`, error);

      if (error.message.includes("document_missing_exception")) {
        await elasticPost(COLLECTION, id, elasticDoc);
        console.log(`Elastic document created for ${COLLECTION} ${id}`);
      }
    });

    await solLogModel.post({
      solId: id,
      baseUrl: process.env.BASE_URL,
      token: process.env.SERVICE_KEY,
      data: {
        solId: id,
        actionType: "update",
        actionData: updateData,
        actionUserId: user.uid,
      },
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

  if (updateData.cnStatus === "notPursuing") updateData.cnType = "nonRelevant";

  try {
    if (!user) throw new Error("Unauthenticated");
    await getById(COLLECTION, id);
    const updatedDoc = await put(COLLECTION, id, updateData);
    const elasticDoc = fireToJs(updatedDoc);
    if (elasticDoc.title) elasticDoc.title_semantic = elasticDoc.title;
    if (elasticDoc.description)
      elasticDoc.description_semantic = elasticDoc.description;
    await elasticPatch(COLLECTION, id, elasticDoc);

    await solLogModel.post({
      solId: id,
      baseUrl: process.env.BASE_URL,
      token: process.env.SERVICE_KEY,
      data: {
        solId: id,
        actionType: "update",
        actionData: updateData,
        actionUserId: user.uid,
      },
    });

    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update in ${COLLECTION} ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    status = 500;
    results = { error: errorMessage };
  }

  return NextResponse.json({ ...results }, { status });
}
