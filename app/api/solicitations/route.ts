import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";

export async function POST(req: NextRequest) {
  const { body } = req;
  const bodyJson = await new NextResponse(body).json();
  const user = await checkSession(req);
  let results;
  let status = 200;

  console.log(bodyJson);

  try {
    if (!user) throw new Error("Unauthenticated");
  } catch (error) {
    console.error(`Failed to create solicitation`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
