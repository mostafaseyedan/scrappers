import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { Client } from "@elastic/elasticsearch";
import { fbToJs, sanitizeForDb } from "@/lib/dataUtils";
import { solicitation as solModel } from "@/app/models";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const elasticClient = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

const db = initDb();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let results;
  try {
    const docRef = db.collection("solicitations").doc(id);
    await docRef.delete();

    const esResp = await elasticClient.delete({
      index: "solicitations",
      id: id,
    });
    if (esResp.result !== "deleted") {
      throw new Error(`Failed to delete document in Elasticsearch ${id}`);
    }

    results = { success: id };
  } catch (error) {
    console.error(`Failed to delete solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  return NextResponse.json(results);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results;

  try {
    // Fetch the solicitation from your database
    const docRef = db.collection("solicitations").doc(id);
    const solicitation = await docRef.get();

    if (!solicitation.exists) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    updateData.updated = Timestamp.now();

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const esupdateData = fbToJs(updateData);

    const esResp = await elasticClient.update({
      index: "solicitations",
      id: id,
      doc: {
        ...esupdateData,
      },
    });

    if (esResp.result !== "updated") {
      throw new Error(`Failed to update document in Elasticsearch ${id}`);
    }

    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  return NextResponse.json(results);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { body } = req;
  const updateData = await new NextResponse(body).json();
  let results;

  try {
    // Fetch the solicitation from your database
    const docRef = db.collection("solicitations").doc(id);
    const solicitation = await docRef.get();

    if (!solicitation.exists) {
      return NextResponse.json(
        { error: "Solicitation not found" },
        { status: 404 }
      );
    }

    const parsedDoc = solModel.schema.parse(updateData);
    await docRef.set(sanitizeForDb({ ...parsedDoc, updated: Timestamp.now() }));
    const updatedDoc = await docRef.get();
    const esupdateData = fbToJs(updatedDoc.data() as Record<string, any>);

    const esResp = await elasticClient.update({
      index: "solicitations",
      id: id,
      doc: {
        ...esupdateData,
      },
    });

    if (esResp.result !== "updated") {
      throw new Error(`Failed to update document in Elasticsearch ${id}`);
    }

    results = updatedDoc.data();
  } catch (error) {
    console.error(`Failed to update solicitation ${id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  return NextResponse.json(results);
}
