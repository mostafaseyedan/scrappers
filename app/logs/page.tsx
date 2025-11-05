"use client";

import { PursuingChart } from "./pursuingChart";
import { WeeklyActivityChart } from "./weeklyActivityChart";
import { SourcePerformanceChart } from "./sourcePerformanceChart";
import { ScrapingJobsChart } from "./scrapingJobsChart";
import { SourceQualityChart } from "./sourceQualityChart";
import { SourceStatusQualityChart } from "./sourceStatusQualityChart";
import { PotentialIssues } from "./potentialIssues";
import { SummaryStat } from "./summaryStat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { scriptLog as scriptLogModel } from "@/app/models";

import styles from "./page.module.scss";

type SummaryStats = {
  totalRFPs: number;
  successRate: number;
  activeSources: number;
  totalJobs: number;
  totalDuplicates: number;
  totalJunk: number;
};

export default function Page() {
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalRFPs: 0,
    successRate: 0,
    activeSources: 0,
    totalJobs: 0,
    totalDuplicates: 0,
    totalJunk: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch summary statistics for scraping
  useEffect(() => {
    const fetchSummaryStats = async () => {
      try {
        // Get all script logs
        const logs = await scriptLogModel.get({
          limit: 1000,
          sort: "created desc",
        });

        // Filter to last 30 days on the client side
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentLogs = logs.results?.filter((log: any) => {
          const logDate = new Date(log.created);
          return logDate >= thirtyDaysAgo;
        }) || [];

        let totalRFPsScraped = 0;
        let successfulJobs = 0;
        let failedJobs = 0;
        let totalDuplicates = 0;
        let totalJunk = 0;
        const sources = new Set<string>();

        recentLogs.forEach((log: any) => {
          // Count RFPs scraped
          totalRFPsScraped += log.successCount || 0;

          // Count successful vs failed jobs
          if (log.status === 'success') {
            successfulJobs += 1;
          } else if (log.status === 'error') {
            failedJobs += 1;
          }

          // Count duplicates and junk
          totalDuplicates += log.dupCount || 0;
          totalJunk += log.junkCount || 0;

          if (log.scriptName) sources.add(log.scriptName);
        });

        console.log("Summary Stats Debug:", {
          totalRFPsScraped,
          successfulJobs,
          failedJobs,
          totalDuplicates,
          totalJunk,
          recentLogsCount: recentLogs.length
        });

        const totalRFPs = totalRFPsScraped;
        const successRate =
          successfulJobs + failedJobs > 0
            ? Math.round((successfulJobs / (successfulJobs + failedJobs)) * 100)
            : 0;
        const activeSources = sources.size;
        const totalJobs = recentLogs.length;

        setSummaryStats({
          totalRFPs,
          successRate,
          activeSources,
          totalJobs,
          totalDuplicates,
          totalJunk,
        });
      } catch (error) {
        console.error("Failed to fetch summary stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryStats();
  }, []);

  return (
    <div className={styles.page}>
      <Tabs defaultValue="scraping">
        <TabsList>
          <TabsTrigger value="scraping">Scraping</TabsTrigger>
          <TabsTrigger value="solicitations">Solicitation</TabsTrigger>
        </TabsList>
        <TabsContent value="scraping">
          {/* Summary Statistics Cards */}
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="text-gray-500">Loading statistics...</div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
              <SummaryStat
                title="RFPs Scraped (30 days)"
                value={summaryStats.totalRFPs.toLocaleString()}
                helper="Total successful"
              />
              <SummaryStat
                title="Success Rate"
                value={`${summaryStats.successRate}%`}
                helper="Success / Total"
              />
              <SummaryStat
                title="Active Sources"
                value={summaryStats.activeSources.toString()}
                helper="Unique scrapers"
              />
              <SummaryStat
                title="Total Scrapping Jobs (30 days)"
                value={summaryStats.totalJobs.toLocaleString()}
                helper="Scraping executions"
              />
              <SummaryStat
                title="Duplicates (30 days)"
                value={summaryStats.totalDuplicates.toLocaleString()}
                helper="Already in system"
              />
              <SummaryStat
                title="Junk (30 days)"
                value={summaryStats.totalJunk.toLocaleString()}
                helper="Filtered out"
              />
            </div>
          )}

          {/* Potential Issues Card */}
          <div className="mb-6">
            <PotentialIssues />
          </div>

          {/* Charts Grid - Stacked Vertically */}
          <div className="flex flex-col gap-6">
            <SourcePerformanceChart />
            <ScrapingJobsChart />
            <SourceQualityChart />
            <WeeklyActivityChart />
          </div>
        </TabsContent>
        <TabsContent value="solicitations">
          <div className="mb-6">
            <SourceStatusQualityChart />
          </div>
          <PursuingChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
