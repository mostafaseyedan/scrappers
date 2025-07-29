import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { get as fireGet, post as firePost } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    results = { results: await fireGet("scriptLogs") };
  } catch (error) {
    console.error(`Failed to get script logs`, error);
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

    const fireDoc = await firePost("scriptLogs", bodyJson, user);

    results = fireDoc;
  } catch (error) {
    console.error(`Failed to create script log`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
