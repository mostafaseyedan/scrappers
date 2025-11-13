import { NextRequest, NextResponse } from "next/server";
import { checkSession } from "@/lib/serverUtils";
import { get as fireGet } from "au/server/firebase";

const COLLECTION = "solicitations";

export async function GET(req: NextRequest) {
  const user = await checkSession(req);
  let results = {};
  let status = 200;

  try {
    if (!user) throw new Error("Unauthenticated");

    // Fetch recent records (sorted by updated desc to get most recent)
    console.log("[Counts] Fetching all solicitations...");
    const allRecords = await fireGet(COLLECTION, {
      limit: 3000,
      sort: "updated desc"
    });
    console.log(`[Counts] Fetched ${allRecords.length} total records`);

    // Filter out nonRelevant once
    const relevantRecords = allRecords.filter(
      (r: any) => r.cnType !== "nonRelevant"
    );
    console.log(`[Counts] ${relevantRecords.length} records after filtering nonRelevant`);

    // Count by cnStatus
    const countByStatus = (status: string) =>
      relevantRecords.filter((r: any) => r.cnStatus === status).length;

    // Count by cnType
    const countByType = (type: string) =>
      relevantRecords.filter((r: any) => r.cnType === type).length;

    const statusCounts = {
      new: countByStatus("new"),
      researching: countByStatus("researching"),
      pursuing: countByStatus("pursuing"),
      preApproval: countByStatus("preApproval"),
      submitted: countByStatus("submitted"),
      negotiation: countByStatus("negotiation"),
      monitor: countByStatus("monitor"),
      foia: countByStatus("foia"),
      awarded: countByStatus("awarded"),
      notWon: countByStatus("notWon"),
      notPursuing: countByStatus("notPursuing"),
    };

    results = {
      ...statusCounts,
      erp: countByType("erp"),
      staffing: countByType("staffing"),
      itSupport: countByType("itSupport"),
      cloud: countByType("cloud"),
      other: countByType("other"),
      facilitiesTelecomHardware: countByType("facilitiesTelecomHardware"),
      nonRelevant: countByType("nonRelevant"),
      total: relevantRecords.length,
    };

    // DIAGNOSTIC: Check for missing/invalid cnStatus
    const sumOfStatusCounts = Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0);
    const missingStatusCount = relevantRecords.length - sumOfStatusCounts;

    if (missingStatusCount > 0) {
      const invalidRecords = relevantRecords.filter((r: any) =>
        !['new', 'researching', 'pursuing', 'preApproval', 'submitted', 'negotiation', 'monitor', 'foia', 'awarded', 'notWon', 'notPursuing'].includes(r.cnStatus)
      );
      console.warn(`[Counts] WARNING: ${missingStatusCount} records with missing/invalid cnStatus!`);
      console.warn(`[Counts] Invalid status examples:`, invalidRecords.slice(0, 5).map((r: any) => ({
        id: r.id,
        cnStatus: r.cnStatus,
        cnType: r.cnType,
        title: r.title?.substring(0, 50)
      })));
    }

    console.log("[Counts] Results:", results);
    console.log("[Counts] Sum of individual statuses:", sumOfStatusCounts, "Total:", relevantRecords.length);
  } catch (error) {
    console.error(`Failed to get ${COLLECTION} count`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    results = { error: errorMessage };
    status = 500;
  }

  return NextResponse.json({ ...results }, { status });
}
