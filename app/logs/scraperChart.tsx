"use client";

import { stat as StatModel } from "@/app/models";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import { format as $d, addDays, subDays } from "date-fns";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";

const EmptyState = ({ message }: { message: string }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    style={{ minHeight: 224 }}
  >
    {message}
  </div>
);

function generateChartData(
  statData: Record<string, any>[],
  endDate: Date,
  days: number
) {
  const data = [];
  const dailyStats: Record<string, Record<string, number>> = {};
  const vendors = new Set<string>();

  for (const stat of statData) {
    if (stat.periodType === "day") {
      const statSegs = stat.key.split("/");
      const vendor = stat.key.includes("firefunctions")
        ? statSegs[2]
        : statSegs[1];
      const dateStr = statSegs[statSegs.length - 1];

      if (vendor.match(/scrapers|undefined|firebasefunctions/)) {
        continue;
      }

      vendors.add(vendor);

      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {};
      }

      if (!dailyStats[dateStr][vendor]) {
        dailyStats[dateStr][vendor] = 0;
      }

      dailyStats[dateStr][vendor] += stat.value;
    }
  }

  for (let day = 0; day < days; day++) {
    const dayStr = $d(subDays(endDate, day), "yyyy-MM-dd");
    const emptyVendorStats = Array.from(vendors).reduce((acc, vendor) => {
      acc[vendor] = 0;
      return acc;
    }, {} as Record<string, number>);

    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = {};
    }

    dailyStats[dayStr] = {
      ...emptyVendorStats,
      ...dailyStats[dayStr],
    };
  }

  for (const [dateStr, vendorData] of Object.entries(dailyStats)) {
    const dateParts = dateStr.split("-");
    const shortDateStr = parseInt(dateParts[1]) + "/" + parseInt(dateParts[2]);
    data.push({
      longDate: dateStr,
      date: shortDateStr,
      ...vendorData,
      total: Object.values(vendorData).reduce((a, b) => a + b, 0),
    });
  }

  data.sort((a, b) => (a.longDate > b.longDate ? 1 : -1));

  return {
    data,
    vendors: Array.from(vendors).sort((a, b) => (a > b ? 1 : -1)),
  };
}

const ScraperChart = () => {
  const [chartData, setChartData] = useState<Record<string, any>[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [days, setDays] = useState<number>(60);

  async function refresh() {
    const startDate = subDays(new Date(), days);
    const endDate = addDays(new Date(), 1);
    const statData = await StatModel.get({
      sort: "startDate desc",
      limit: 1000,
      filters: {
        parentKey: "scraperSuccess",
        periodType: "day",
        startDate: `> ${$d(startDate, "yyyy-MM-dd")} AND < ${$d(
          endDate,
          "yyyy-MM-dd"
        )}`,
      },
    });

    if (statData.results?.length) {
      const { data, vendors } = generateChartData(
        statData.results,
        endDate,
        days
      );
      setChartData(data);
      setVendors(vendors);
    }
  }

  useEffect(() => {
    refresh();
  }, [days]);

  const hasActivity = chartData.some((point) => point.total > 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Successful Solicitations by Source
          </h3>
          <p className="text-sm text-gray-500">
            Daily breakdown by vendor/source (last{" "}
            <Select
              value={days.toString()}
              onValueChange={(value) => {
                setDays(Number(value));
              }}
            >
              <SelectTrigger className="inline-flex w-16 h-6 text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
              </SelectContent>
            </Select>{" "}
            days)
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid
                stroke="#E5E7EB"
                strokeDasharray="6 6"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "rgba(229, 231, 235, 0.3)" }}
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
              />
              {vendors.map((vendor, i) => (
                <Bar
                  key={vendor}
                  stackId="a"
                  dataKey={vendor}
                  fill={`hsl(${(i * 360) / vendors.length}, 70%, 50%)`}
                  name={vendor}
                >
                  {i === vendors.length - 1 ? (
                    <LabelList
                      dataKey="total"
                      position="top"
                      fill="#9CA3AF"
                      style={{ fontSize: 11 }}
                      content={(props: any) => {
                        const { value, x, y, width } = props;
                        if (!value) return null;
                        const cx =
                          typeof x === "number" && typeof width === "number"
                            ? x + width / 2
                            : x;
                        return (
                          <text
                            x={cx}
                            y={y - 4}
                            fill="#9CA3AF"
                            textAnchor="middle"
                            fontSize={11}
                          >
                            {value}
                          </text>
                        );
                      }}
                    />
                  ) : null}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No successful solicitations in the selected time period." />
        </div>
      )}
    </div>
  );
};

export { ScraperChart };
