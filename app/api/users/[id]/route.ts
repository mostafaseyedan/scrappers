import { NextRequest, NextResponse } from "next/server";
import { getById } from "@/lib/firebaseAdmin";
import { checkSession } from "@/lib/serverUtils";
import { initAuth } from "@/lib/firebaseAdmin";
import { z } from "zod";

const auth = initAuth();
const COLLECTION = "users";

const patchSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(100).optional(),
  photoURL: z.string().url().optional(),
});

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

    results = await auth.getUser(id);
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
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    await auth.getUser(id);

    const sanitizedData = patchSchema.parse(updateData);

    results = await auth.updateUser(id, sanitizedData);
  } catch (error) {
    console.error(`Failed to update in ${COLLECTION} ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json(results, { status });
}
