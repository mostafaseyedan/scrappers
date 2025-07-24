import { NextResponse } from "next/server";

export async function GET() {
  console.log(process.env);

  return NextResponse.json(
    { message: "This is a test route for solicitations" },
    { status: 200 }
  );
}
