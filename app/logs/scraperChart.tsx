"use client";

import { stat as StatModel } from "@/app/models";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

import styles from "./scraperChart.module.scss";

const chartConfig = {} satisfies ChartConfig;

function generateChartData(statData: Record<string, any>[], endDate: Date) {
  const data = [];
  const dailyStats: Record<string, Record<string, number>> = {};
  const vendors = new Set<string>();

  for (const stat of statData) {
    if (stat.periodType === "day") {
      const statSegs = stat.key.split("/");
      const vendor = statSegs[1];
      const dateStr = statSegs[statSegs.length - 1];
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

  for (let day = 0; day < 15; day++) {
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
    });
  }

  data.sort((a, b) => (a.date > b.date ? 1 : -1));

  return { data, vendors: Array.from(vendors) };
}

const ScraperChart = () => {
  const [chartData, setChartData] = useState<Record<string, any>[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);

  async function refresh() {
    const startDate = subDays(new Date(), 15);
    const endDate = addDays(new Date(), 1);
    const statData = await StatModel.get({
      sort: "startDate desc",
      filters: {
        startDate: `> ${$d(startDate, "yyyy-MM-dd")} AND < ${$d(
          endDate,
          "yyyy-MM-dd"
        )}`,
      },
    });

    if (statData.results?.length) {
      const { data, vendors } = generateChartData(statData.results, endDate);
      setChartData(data);
      setVendors(vendors);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card className={styles.scraperChart}>
      <CardHeader>
        <CardTitle>Solicitations Success Count</CardTitle>
        <CardDescription>last 15 days</CardDescription>
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
              content={<ChartTooltipContent indicator="line" />}
            />
            {vendors.map((vendor, i) => (
              <Bar
                key={vendor}
                stackId="a"
                dataKey={vendor}
                fill={`var(--chart-${i + 1})`}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm"></CardFooter>
    </Card>
  );
};

export { ScraperChart };
