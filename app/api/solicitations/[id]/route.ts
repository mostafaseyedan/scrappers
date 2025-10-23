import { NextRequest, NextResponse } from "next/server";
import { fireToJs } from "@/lib/dataUtils";
import { getById, patch, put, remove as fireRemove } from "au/server/firebase";
import {
  remove as algoliaRemove,
  patch as algoliaPatch,
  post as algoliaPost,
} from "@/lib/algolia";
import { checkSession } from "@/lib/serverUtils";
import {
  solicitation_log as solLogModel,
  source as sourceModel,
} from "@/app/models";

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
    await algoliaRemove(COLLECTION, id);
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

    // Update issuer based on sourceKey
    if (updateData.issuer) {
      // Do nothing, issuer is already set
    } else if (updateData.sourceKey) {
      const sourceDoc = await sourceModel
        .getByKey({
          baseUrl: process.env.BASE_URL,
          token: process.env.SERVICE_KEY,
          key: updateData.sourceKey,
        })
        .catch((err: any) => console.error(err));
      if (sourceDoc?.name) {
        updateData.issuer = sourceDoc.name;
      }
    } else if (updateData.sourceKey === "") {
      updateData.issuer = "";
    }

    const updatedDoc = await patch(COLLECTION, id, updateData);
    const algoliaDoc = fireToJs(updatedDoc);

    if (algoliaDoc.publishDate === "") algoliaDoc.publishDate = null;
    if (algoliaDoc.closingDate === "") algoliaDoc.closingDate = null;

    // If the algolia document is missing, create it
    await algoliaPatch(COLLECTION, id, algoliaDoc).catch(async (error) => {
      console.error(`Failed to update algolia for ${COLLECTION} ${id}`, error);

      if (error.message.includes("document_missing_exception")) {
        await algoliaPost(COLLECTION, id, algoliaDoc);
        console.log(`Algolia document created for ${COLLECTION} ${id}`);
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
    await algoliaPatch(COLLECTION, id, fireToJs(updatedDoc));

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
