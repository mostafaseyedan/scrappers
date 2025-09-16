import { NextRequest, NextResponse } from "next/server";
import { Client } from "@elastic/elasticsearch";
import { checkSession } from "@/lib/serverUtils";

const elasticApiKey = process.env.ELASTIC_API_KEY;
if (!elasticApiKey) {
  throw new Error("ELASTIC_API_KEY environment variable is not defined");
}

const elasticClient = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: elasticApiKey },
  serverMode: "serverless",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user = await checkSession(req);
  const q = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "publishDate desc";
  const contains = searchParams.get("contains") === "true" ? true : false;

  const must: any[] = [];
  const filterArr: any[] = [];
  let queryObj = {};

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 500 });
  }

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("filter.")) {
      const field = key.substring(7);
      filterArr.push({
        match: {
          [field]: value,
        },
      });
    }
  }

  if (q) {
    if (contains) {
      // "contains" search: approximate infix match using wildcard per term across fields.
      // Note: This is slower on large datasets and matches within single tokens.
      // For scalable infix search, add an n-gram subfield and use match on that field.
      const fields = [
        "title",
        "description",
        "keywords",
        "categories",
        "cnNotes",
        "location",
        "issuer",
        "id",
        "site",
        "siteId",
      ];
      const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

      for (const term of terms) {
        must.push({
          bool: {
            should: fields.map((f) => ({
              wildcard: {
                [f]: {
                  value: `*${term}*`,
                  case_insensitive: true,
                },
              },
            })),
            minimum_should_match: 1,
          },
        });
      }

      queryObj = {
        query: {
          bool: {
            must,
            filter: filterArr,
          },
        },
      };
    } else {
      must.push({
        multi_match: {
          query: q,
          fields: [
            "title",
            "description",
            "keywords",
            "categories",
            "cnNotes",
            "location",
            "issuer",
            "id",
            "site",
            "siteId",
          ],
          fuzziness: "AUTO",
        },
      });
      queryObj = {
        query: {
          bool: {
            must,
            filter: filterArr,
          },
        },
      };
    }
  } else if (filterArr.length > 0) {
    queryObj = {
      query: {
        bool: {
          filter: filterArr,
        },
      },
    };
  } else {
    queryObj = {
      query: {
        match_all: {},
      },
    };
  }

  const [sortField, sortOrder] = sort.split(" ");
  const sortObj = {
    [sortField]: sortOrder || "desc",
  };

  const result = await elasticClient.search({
    index: "solicitations",
    from: (page - 1) * limit,
    ...(limit > 0 ? { size: limit } : {}),
    sort: sortObj,
    ...queryObj,
  });

  return NextResponse.json(result);
}
