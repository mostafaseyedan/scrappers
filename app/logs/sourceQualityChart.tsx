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

type SourceQualityDataPoint = {
  source: string;
  scraped: number;
  duplicates: number;
  junk: number;
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

export const SourceQualityChart = () => {
  const [data, setData] = useState<SourceQualityDataPoint[]>([]);
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

        // Get all unique base names from all logs (combining duplicates)
        const allBaseNames = new Set<string>();
        logs.results?.forEach((log: any) => {
          if (log.scriptName) {
            let baseName = log.scriptName;
            if (baseName.includes('/')) {
              const parts = baseName.split('/');
              baseName = parts[parts.length - 1];
            }
            allBaseNames.add(baseName);
          }
        });

        // Aggregate scraped RFPs, duplicates and junk by base name
        const sourceData: Record<
          string,
          { scraped: number; duplicates: number; junk: number }
        > = {};

        // Initialize all base names with 0
        allBaseNames.forEach((baseName) => {
          sourceData[baseName] = { scraped: 0, duplicates: 0, junk: 0 };
        });

        // Count from recent logs only, combining duplicates
        recentLogs.forEach((log: any) => {
          const source = log.scriptName || "Unknown";
          let baseName = source;
          if (source.includes('/')) {
            const parts = source.split('/');
            baseName = parts[parts.length - 1];
          }
          if (!sourceData[baseName]) {
            sourceData[baseName] = { scraped: 0, duplicates: 0, junk: 0 };
          }
          sourceData[baseName].scraped += log.successCount || 0;
          sourceData[baseName].duplicates += log.dupCount || 0;
          sourceData[baseName].junk += log.junkCount || 0;
        });


        // Convert to array
        const chartData = Object.entries(sourceData)
          .map(([source, counts]) => {
            // Limit to 20 chars for display
            let displayName = source;
            if (displayName.length > 20) {
              displayName = displayName.slice(0, 20) + "...";
            }

            return {
              source: displayName,
              fullSource: source,
              scraped: counts.scraped,
              duplicates: counts.duplicates,
              junk: counts.junk,
              total: counts.scraped + counts.duplicates + counts.junk,
            };
          })
          // Filter out sources with zero total
          .filter((item) => item.total > 0)
          // Sort by total count descending
          .sort((a, b) => b.total - a.total);

        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch source quality data:", error);
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
            Junks vs Duplicates vs Scraped RFPs by Source
          </h3>
          <p className="text-sm text-gray-500">
            last 7 days
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: 5,
                left: 5,
                bottom: 5,
              }}
            >
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
                cursor={{ fill: "rgba(229, 231, 235, 0.3)" }}
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
              />
              <Legend />
              <Bar
                dataKey="scraped"
                fill="#2563EB"
                name="Scraped RFPs"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="duplicates"
                fill="#F59E0B"
                name="Duplicates"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="junk"
                fill="#EF4444"
                name="Junk"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No source activity in the last 7 days." />
        </div>
      )}
    </div>
  );
};
