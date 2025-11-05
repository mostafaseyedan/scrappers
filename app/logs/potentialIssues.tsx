"use client";

import { useEffect, useState } from "react";
import { scriptLog as scriptLogModel } from "@/app/models";

type IssueData = {
  scraperIssues: string[]; // Sources with jobs but zero results
  inactiveSources: string[]; // Sources with no jobs
};

export const PotentialIssues = () => {
  const [issues, setIssues] = useState<IssueData>({
    scraperIssues: [],
    inactiveSources: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get all script logs
        const logs = await scriptLogModel.get({
          limit: 1000,
          sort: "created desc",
        });

        // Filter to last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentLogs = logs.results?.filter((log: any) => {
          const logDate = new Date(log.created);
          return logDate >= sevenDaysAgo;
        }) || [];

        // Get all unique base names from all logs
        const allBaseNames = new Set<string>();
        logs.results?.forEach((log: any) => {
          if (log.scriptName) {
            let baseName = log.scriptName;
            if (baseName.includes("/")) {
              const parts = baseName.split("/");
              baseName = parts[parts.length - 1];
            }
            allBaseNames.add(baseName);
          }
        });

        // Track job counts and results by source
        const sourceStats: Record<
          string,
          { jobs: number; scraped: number; duplicates: number; junk: number }
        > = {};

        // Initialize all sources
        allBaseNames.forEach((baseName) => {
          sourceStats[baseName] = { jobs: 0, scraped: 0, duplicates: 0, junk: 0 };
        });

        // Count from recent logs
        recentLogs.forEach((log: any) => {
          const source = log.scriptName || "Unknown";
          let baseName = source;
          if (source.includes("/")) {
            const parts = source.split("/");
            baseName = parts[parts.length - 1];
          }

          if (sourceStats[baseName]) {
            sourceStats[baseName].jobs += 1;
            sourceStats[baseName].scraped += log.successCount || 0;
            sourceStats[baseName].duplicates += log.dupCount || 0;
            sourceStats[baseName].junk += log.junkCount || 0;
          }
        });

        // Identify issues
        const scraperIssues: string[] = [];
        const inactiveSources: string[] = [];

        Object.entries(sourceStats).forEach(([source, stats]) => {
          const totalResults = stats.scraped + stats.duplicates + stats.junk;

          if (stats.jobs > 0 && totalResults === 0) {
            // Has jobs but zero results - scraper issue
            scraperIssues.push(source);
          } else if (stats.jobs === 0) {
            // No jobs - not being scraped
            inactiveSources.push(source);
          }
        });

        setIssues({
          scraperIssues: scraperIssues.sort(),
          inactiveSources: inactiveSources.sort(),
        });
      } catch (error) {
        console.error("Failed to fetch potential issues:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  const hasIssues =
    issues.scraperIssues.length > 0 || issues.inactiveSources.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Potential Issues
          </h3>
          <p className="text-sm text-gray-500">

          </p>
        </div>
      </div>

      {hasIssues && (
        <div className="space-y-4">
          {issues.scraperIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Scraper Issues ({issues.scraperIssues.length})
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Sources that scrapper ran but returned zero results (not even duplicates or junk)
              </p>
              <div className="flex flex-wrap gap-2">
                {issues.scraperIssues.map((source) => (
                  <span
                    key={source}
                    className="inline-block rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {issues.inactiveSources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Inactive Sources ({issues.inactiveSources.length})
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Sources not being scraped in last 7 days
              </p>
              <div className="flex flex-wrap gap-2">
                {issues.inactiveSources.map((source) => (
                  <span
                    key={source}
                    className="inline-block rounded-md bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
