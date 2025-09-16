"use client";

import { stat as StatModel } from "@/app/models";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useEffect, useState } from "react";
import { format as $d, addDays, subDays } from "date-fns";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";

import styles from "./scraperChart.module.scss";

const chartConfig = {} satisfies ChartConfig;

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
    data.push({
      date: $d(dateStr, "M/dd"),
      ...vendorData,
      total: Object.values(vendorData).reduce((a, b) => a + b, 0),
    });
  }

  data.sort((a, b) => (a.date > b.date ? 1 : -1));

  return {
    data,
    vendors: Array.from(vendors).sort((a, b) => (a > b ? 1 : -1)),
  };
}

const ScraperChart = () => {
  const [chartData, setChartData] = useState<Record<string, any>[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [days, setDays] = useState<number>(30);

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
      console.log({ data, vendors });
      setChartData(data);
      setVendors(vendors);
    }
  }

  useEffect(() => {
    refresh();
  }, [days]);

  return (
    <Card className={styles.scraperChart}>
      <CardHeader>
        <CardTitle>Solicitations Success Count</CardTitle>
        <CardDescription className={styles.scraperChart_cardDescription}>
          last{" "}
          <Select
            value={days.toString()}
            onValueChange={(value) => {
              setDays(Number(value));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="60">60</SelectItem>
            </SelectContent>
          </Select>{" "}
          days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className={styles.scraperChart_chart}
          config={chartConfig}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={true}
              axisLine={true}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="w-[180px]" />}
            />
            {vendors.map((vendor, i) => (
              <Bar
                key={vendor}
                stackId="a"
                dataKey={vendor}
                fill={`var(--chart-${i + 1 >= 10 ? 3 : i + 1})`}
              >
                {i === vendors.length - 1 ? (
                  <LabelList
                    dataKey="total"
                    position="top"
                    fill="#ccc"
                    content={(props: any) => {
                      const { value, x, y, width } = props;
                      if (!value) return null; // hide when total is 0 or falsy
                      const cx =
                        typeof x === "number" && typeof width === "number"
                          ? x + width / 2
                          : x;
                      return (
                        <text x={cx} y={y - 4} fill="#ccc" textAnchor="middle">
                          {value}
                        </text>
                      );
                    }}
                  />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { ScraperChart };
