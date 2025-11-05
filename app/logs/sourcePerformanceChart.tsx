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
import { solicitation as solModel } from "@/app/models";

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
        // Get all solicitations
        const solicitations = await solModel.get({
          limit: 10000,
          sort: "created desc",
        });

        // Filter to last 7 days (including today) based on created date
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0); // Start of day 7 days ago

        const recentSols = solicitations.results?.filter((sol: any) => {
          const createdDate = new Date(sol.created);
          return createdDate >= sevenDaysAgo;
        }) || [];

        // Aggregate by source
        const sourceData: Record<string, { success: number }> = {};

        const biddirectSols: any[] = [];
        recentSols.forEach((sol: any) => {
          const source = sol.site || sol.siteId || "Unknown";
          if (!sourceData[source]) {
            sourceData[source] = { success: 0 };
          }
          sourceData[source].success += 1;

          // Collect BidDirect solicitations for analysis
          if (source.toLowerCase() === 'biddirect') {
            biddirectSols.push({
              id: sol.id,
              title: sol.title?.substring(0, 40),
              created: new Date(sol.created).toLocaleString(),
              createdISO: sol.created,
            });
          }
        });

        // Log BidDirect details
        if (biddirectSols.length > 0) {
          console.log(`[SourcePerformanceChart] BidDirect: ${biddirectSols.length} solicitations in last 7 days`);
          console.table(biddirectSols);
        }

        // Get all unique sources
        const allSources = Object.keys(sourceData);

        // Convert to array
        const chartData = allSources.map((source) => {
          // Limit to 20 chars for display
          let displayName = source;
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
        // Filter out sources with zero RFPs
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
