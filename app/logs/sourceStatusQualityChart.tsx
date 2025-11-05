"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
} from "recharts";
import { solicitation as solModel } from "@/app/models";

type SourceQualityDataPoint = {
  source: string;
  qualityRatio: number;
  totalSolicitations: number;
  highValueCount: number;
  notPursuingCount: number;
  qualityTier: string;
};

const EmptyState = ({ message }: { message: string }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    style={{ minHeight: 224 }}
  >
    {message}
  </div>
);

export const SourceStatusQualityChart = () => {
  const [data, setData] = useState<SourceQualityDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // High-value statuses (researching, pursuing, monitor, pre-approval, negotiation, FOIA, awarded)
        const highValueStatuses = [
          "researching",
          "pursuing",
          "monitor",
          "preApproval",
          "negotiation",
          "foia",
          "awarded",
        ];

        // Get all solicitations
        const solicitations = await solModel.get({
          limit: 10000,
        });

        // Aggregate by source
        const sourceData: Record<
          string,
          {
            highValueCount: number;
            notPursuingCount: number;
            total: number;
          }
        > = {};

        solicitations.results?.forEach((sol: any) => {
          const source = sol.site || sol.subsiteKey || "Unknown";

          if (!sourceData[source]) {
            sourceData[source] = {
              highValueCount: 0,
              notPursuingCount: 0,
              total: 0,
            };
          }

          sourceData[source].total += 1;

          if (highValueStatuses.includes(sol.cnStatus)) {
            sourceData[source].highValueCount += 1;
          } else if (sol.cnStatus === "notPursuing") {
            sourceData[source].notPursuingCount += 1;
          }
        });

        // Convert to array and calculate quality ratio
        const chartData = Object.entries(sourceData)
          .map(([source, counts]) => {
            // Quality ratio: high-value / (high-value + not-pursuing)
            // If denominator is 0, consider it as 0 quality
            const denominator = counts.highValueCount + counts.notPursuingCount;
            const qualityRatio =
              denominator > 0 ? counts.highValueCount / denominator : 0;

            // Determine quality tier
            let qualityTier = "none";
            if (qualityRatio >= 0.25) {
              qualityTier = "excellent";
            } else if (qualityRatio >= 0.15) {
              qualityTier = "good";
            } else if (qualityRatio >= 0.05) {
              qualityTier = "fair";
            } else if (qualityRatio > 0) {
              qualityTier = "poor";
            }

            // Limit source name to 20 chars for display
            let displayName = source;
            if (displayName.length > 20) {
              displayName = displayName.slice(0, 17) + "...";
            }

            return {
              source: displayName,
              fullSource: source,
              qualityRatio: Math.round(qualityRatio * 100), // Convert to percentage
              totalSolicitations: counts.total,
              highValueCount: counts.highValueCount,
              notPursuingCount: counts.notPursuingCount,
              qualityTier,
            };
          })
          // Filter out sources with no high-value or not-pursuing solicitations
          .filter((item) => item.highValueCount + item.notPursuingCount > 0)
          // Sort by quality ratio descending
          .sort((a, b) => b.qualityRatio - a.qualityRatio);


        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch source status quality data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex h-72 items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Source Quality by Status
          </h3>
          <p className="text-sm text-gray-500">
            Quality ratio vs total solicitations (bubble size = high-value count)
          </p>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="mt-4 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 20,
                  left: 20,
                }}
              >
                <CartesianGrid
                  stroke="#E5E7EB"
                  strokeDasharray="6 6"
                />
                <XAxis
                  type="number"
                  dataKey="totalSolicitations"
                  name="Total Solicitations"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={6}
                  label={{
                    value: "Total Solicitations",
                    position: "insideBottom",
                    offset: -10,
                    style: { fontSize: 12, fill: "#64748b" },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="qualityRatio"
                  name="Quality Ratio"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  label={{
                    value: "Quality Ratio (%)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12, fill: "#64748b" },
                  }}
                />
                <ZAxis type="number" dataKey="highValueCount" range={[150, 3500]} name="High-Value Count" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                          <p className="font-semibold text-gray-900">
                            {data.fullSource}
                          </p>
                          <p className="text-sm text-gray-600">
                            Quality Ratio: {data.qualityRatio}%
                          </p>
                          <p className="text-sm text-gray-600">
                            Total Solicitations: {data.totalSolicitations}
                          </p>
                          <p className="text-sm text-green-600">
                            High-Value: {data.highValueCount}
                          </p>
                          <p className="text-sm text-red-600">
                            Not Pursuing: {data.notPursuingCount}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Tier: {data.qualityTier}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "40px" }} />
                <Scatter
                  name="Excellent (≥25%)"
                  data={data.filter(d => d.qualityTier === "excellent")}
                  fill="#10b981"
                  fillOpacity={0.3}
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Scatter
                  name="Good (15-24%)"
                  data={data.filter(d => d.qualityTier === "good")}
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Scatter
                  name="Fair (5-14%)"
                  data={data.filter(d => d.qualityTier === "fair")}
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Scatter
                  name="Poor (<5%)"
                  data={data.filter(d => d.qualityTier === "poor")}
                  fill="#ef4444"
                  fillOpacity={0.3}
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState message="No solicitation data available." />
        </div>
      )}
    </div>
  );
};
