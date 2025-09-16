import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import {
  count,
  get as fireGet,
  parseQueryString,
  post as firePost,
} from "@/lib/firebaseAdmin";
import { stat as statModel } from "@/app/models";

const COLLECTION = "stats";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  const queryOptions = parseQueryString(req.url);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    const records = await fireGet(COLLECTION, queryOptions);
    const total = await count(COLLECTION);
    results = {
      total,
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

    const parsedData = statModel.schema.db.parse(bodyJson);
    const fireDoc = await firePost(COLLECTION, parsedData, user);

    results = fireDoc;
  } catch (error) {
    console.error(`Failed to create ${COLLECTION}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
