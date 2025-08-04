import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { solicitation as solModel } from "@/app/models";
import {
  get as fireGet,
  post as firePost,
  parseQueryString,
} from "@/lib/firebaseAdmin";
import { post as elasticPost } from "@/lib/elastic";
import { fireToJs } from "@/lib/dataUtils";

const COLLECTION = "solicitations";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  const queryOptions = parseQueryString(req.url);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    const records = await fireGet(COLLECTION, queryOptions);
    results = {
      count: records.length,
      results: records,
    };
  } catch (error) {
    console.error(`Failed to get ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}

export async function POST(req: NextRequest) {
  const { body } = req;
  const bodyJson = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results;
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    bodyJson.created = new Date().toISOString();
    bodyJson.updated = new Date().toISOString();
    bodyJson.authorId = user.uid;

    const parsedData = solModel.schema.postApi.parse(bodyJson);
    const fireDoc = await firePost(COLLECTION, parsedData, user);
    const elasticDoc = fireToJs(fireDoc);

    if (elasticDoc.title) elasticDoc.title_semantic = elasticDoc.title;
    if (elasticDoc.description)
      elasticDoc.description_semantic = elasticDoc.description;

    await elasticPost(COLLECTION, fireDoc.id, elasticDoc);

    results = fireDoc;
  } catch (error) {
    console.error(`Failed to create ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
