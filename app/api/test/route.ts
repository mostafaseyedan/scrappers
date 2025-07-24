import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  console.log(process.env);
  return NextResponse.json({ message: "Test route is working!" });
}
