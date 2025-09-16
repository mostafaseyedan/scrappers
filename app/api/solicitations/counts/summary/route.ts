import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { count as fireCount } from "@/lib/firebaseAdmin";

const COLLECTION = "solicitations";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    results = {
      new: await fireCount(COLLECTION, { filters: { cnStatus: "new" } }),
      researching: await fireCount(COLLECTION, {
        filters: { cnStatus: "researching" },
      }),
      pursuing: await fireCount(COLLECTION, {
        filters: { cnStatus: "pursuing" },
      }),
      preApproval: await fireCount(COLLECTION, {
        filters: { cnStatus: "preApproval" },
      }),
      submitted: await fireCount(COLLECTION, {
        filters: { cnStatus: "submitted" },
      }),
      negotiation: await fireCount(COLLECTION, {
        filters: { cnStatus: "negotiation" },
      }),
      monitor: await fireCount(COLLECTION, {
        filters: { cnStatus: "monitor" },
      }),
      foia: await fireCount(COLLECTION, {
        filters: { cnStatus: "foia" },
      }),
      awarded: await fireCount(COLLECTION, {
        filters: { cnStatus: "awarded" },
      }),
      notWon: await fireCount(COLLECTION, { filters: { cnStatus: "notWon" } }),
      notPursuing: await fireCount(COLLECTION, {
        filters: { cnStatus: "notPursuing" },
      }),
      erp: await fireCount(COLLECTION, { filters: { cnType: "erp" } }),
      staffing: await fireCount(COLLECTION, {
        filters: { cnType: "staffing" },
      }),
      itSupport: await fireCount(COLLECTION, {
        filters: { cnType: "itSupport" },
      }),
      cloud: await fireCount(COLLECTION, { filters: { cnType: "cloud" } }),
      other: await fireCount(COLLECTION, { filters: { cnType: "other" } }),
      facilitiesTelecomHardware: await fireCount(COLLECTION, {
        filters: { cnType: "facilitiesTelecomHardware" },
      }),
      nonRelevant: await fireCount(COLLECTION, {
        filters: { cnType: "nonRelevant" },
      }),
      total: await fireCount(COLLECTION),
    };
  } catch (error) {
    console.error(`Failed to get ${COLLECTION} count`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
