"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { scriptLog as scriptLogModel } from "@/app/models";

type JobDataPoint = {
  source: string;
  count: number;
};

const EmptyState = ({ message }: { message: string }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    style={{ minHeight: 224 }}
  >
    {message}
  </div>
);

export const ScrapingJobsChart = () => {
  const [data, setData] = useState<JobDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get all script logs
        const logs = await scriptLogModel.get({
          limit: 1000,
          sort: "created desc",
        });

        // Filter to last 7 days on the client side
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentLogs = logs.results?.filter((log: any) => {
          const logDate = new Date(log.created);
          return logDate >= sevenDaysAgo;
        }) || [];

        // Get all unique sources from all logs (not just recent)
        const allSources = new Set<string>();
        logs.results?.forEach((log: any) => {
          if (log.scriptName) {
            allSources.add(log.scriptName);
          }
        });

        // Count job executions by source name (combining duplicates)
        const jobCounts: Record<string, number> = {};

        // Extract base name and combine counts
        allSources.forEach((source) => {
          let baseName = source;
          if (source.includes('/')) {
            const parts = source.split('/');
            baseName = parts[parts.length - 1]; // Get last part
          }
          if (!jobCounts[baseName]) {
            jobCounts[baseName] = 0;
          }
        });

        // Count jobs from recent logs
        recentLogs.forEach((log: any) => {
          const source = log.scriptName || "Unknown";
          let baseName = source;
          if (source.includes('/')) {
            const parts = source.split('/');
            baseName = parts[parts.length - 1];
          }
          jobCounts[baseName] = (jobCounts[baseName] || 0) + 1;
        });

        console.log("[ScrapingJobsChart] All sources:", Array.from(allSources));
        console.log("[ScrapingJobsChart] Recent logs count:", recentLogs.length);
        console.log("[ScrapingJobsChart] Job counts (combined):", jobCounts);

        // Convert to array and sort by count
        const chartData = Object.entries(jobCounts)
          .map(([source, count]) => {
            // Limit to 20 chars for display
            let displayName = source;
            if (displayName.length > 20) {
              displayName = displayName.slice(0, 20) + "...";
            }

            return {
              source: displayName,
              fullSource: source,
              count,
            };
          })
          // Don't filter - show all sources including those with 0 jobs
          .sort((a, b) => b.count - a.count);

        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch scraping jobs data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hasActivity = data.some((point) => point.count > 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex h-72 items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Scraping Job Frequency
          </h3>
          <p className="text-sm text-gray-500">
            Job execution count by source (last 7 days)
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid
                stroke="#E5E7EB"
                strokeDasharray="6 6"
                vertical={false}
              />
              <XAxis
                dataKey="source"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                formatter={(value: number) => [`${value} jobs`, "Executions"]}
              />
              <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No scraping jobs recorded in the last 7 days." />
        </div>
      )}
    </div>
  );
};
