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
  Legend,
} from "recharts";
import { scriptLog as scriptLogModel } from "@/app/models";

type SourceDataPoint = {
  source: string;
  success: number;
  total: number;
};

const EmptyState = ({ message }: { message: string }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    style={{ minHeight: 224 }}
  >
    {message}
  </div>
);

export const SourcePerformanceChart = () => {
  const [data, setData] = useState<SourceDataPoint[]>([]);
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

        // Aggregate by source
        const sourceData: Record<string, { success: number }> = {};

        recentLogs.forEach((log: any) => {
          const source = log.scriptName || "Unknown";
          if (!sourceData[source]) {
            sourceData[source] = { success: 0 };
          }
          sourceData[source].success += log.successCount || 0;
        });

        // Get all unique sources (including those with 0 counts)
        const allSources = Object.keys(sourceData);

        // Convert to array with better source name formatting
        const chartData = allSources.map((source) => {
          // Extract the actual scraper name from paths like "Firefunctions/scrapers/sourceName"
          let displayName = source;
          if (source.includes('/')) {
            const parts = source.split('/');
            displayName = parts[parts.length - 1]; // Get last part
          }
          // Limit to 20 chars for display
          if (displayName.length > 20) {
            displayName = displayName.slice(0, 20) + "...";
          }

          return {
            source: displayName,
            fullSource: source, // Keep original for tooltip
            success: sourceData[source]?.success || 0,
            total: sourceData[source]?.success || 0,
          };
        })
        // Filter out sources with zero RFPs scraped
        .filter((item) => item.success > 0)
        // Sort by success count descending
        .sort((a, b) => b.success - a.success);

        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch source performance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hasActivity = data.some((point) => point.total > 0);

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
            RFPs scraped by source
          </h3>
          <p className="text-sm text-gray-500">
            last 7 days
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
                tickMargin={10}
              />
              <Tooltip
                cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                formatter={(value: number) => [`${value} RFPs`, "Scraped"]}
              />
              <Bar
                dataKey="success"
                fill="#2563EB"
                name="RFPs Scraped"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No source data available for the last 7 days." />
        </div>
      )}
    </div>
  );
};
