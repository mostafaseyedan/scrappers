"use client";

import { List as CnList } from "@/components/cendien/list";
import { ScraperChart } from "./scraperChart";
import { PursuingChart } from "./pursuingChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContext, useEffect } from "react";
import { format as $d } from "date-fns";
import { UserContext } from "@/app/userContext";
import { uidsToNames } from "@/lib/utils";
import { solicitation as solModel } from "@/app/models";

import styles from "./page.module.scss";

export default function Page() {
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;

  useEffect(() => {}, []);

  return (
    <div className={styles.page}>
      <Tabs defaultValue="scripts">
        <TabsList>
          <TabsTrigger value="scripts">Script</TabsTrigger>
          <TabsTrigger value="solicitations">Solicitation</TabsTrigger>
        </TabsList>
        <TabsContent value="scripts">
          <ScraperChart />
          <CnList
            className={styles.logsList}
            url="/api/scriptLogs"
            itemTemplate={(item) => (
              <article
                className={styles.logsList_item}
                key={`logsList-item-${item.id}`}
              >
                <div className={styles.logsList_item_created}>
                  {$d(item.created, "M/d/yyyy h:mm a")}
                </div>
                <div className={styles.logsList_item_main}>
                  {item.message}{" "}
                  <span className={styles.logsList_item_timeStr}>
                    <var>{item.timeStr}</var>
                  </span>
                  <div className={styles.logsList_item_scriptName}>
                    {item.scriptName}
                  </div>
                </div>
                <div className={styles.logsList_item_results}>
                  <span className={styles.logsList_item_results_success}>
                    <label>Success</label> <var>{item.successCount || 0}</var>
                  </span>
                  <span className={styles.logsList_item_results_fail}>
                    <label>Fail</label> <var>{item.failCount || 0}</var>
                  </span>
                  <span className={styles.logsList_item_results_junk}>
                    <label>Junk</label> <var>{item.junkCount || 0}</var>
                  </span>
                  <span className={styles.logsList_item_results_duplicates}>
                    <label>Dups</label> <var>{item.dupCount || 0}</var>
                  </span>
                </div>
              </article>
            )}
          />
        </TabsContent>
        <TabsContent value="solicitations">
          <PursuingChart />
          <CnList
            className={styles.solsList}
            url="/api/solicitations/logs"
            onPreResults={async (logs) => {
              if (!getUser) return logs;

              // Get user name for each actionUserId
              const userIds = new Set<string>();
              const solIds = new Set<string>();

              logs.forEach((log) => {
                if (log.actionUserId) userIds.add(log.actionUserId as string);
                if (log.solId) solIds.add(log.solId as string);
              });

              const userIdsArr: string[] = Array.from(userIds);
              const solIdsArr: string[] = Array.from(solIds);

              const userNames = await uidsToNames(userIdsArr, getUser);
              const userMap = new Map(
                userIdsArr.map((id, idx) => [id, userNames[idx]])
              );
              const solsEntries: [string, any][] = await Promise.all(
                solIdsArr.map(async (id) => {
                  const sol =
                    (await solModel.getById({ id }).catch(() => null)) || {};
                  return [id, sol] as [string, any];
                })
              );
              const solsMap = new Map(solsEntries);

              return logs
                .sort(
                  (a, b) =>
                    new Date(b.created).getTime() -
                    new Date(a.created).getTime()
                )
                .map((log) => ({
                  ...log,
                  actionUser: userMap.get(log.actionUserId) || log.actionUserId,
                  sol: solsMap.get(log.solId) || {},
                }));
            }}
            itemTemplate={(item) => (
              <article
                className={styles.solsList_item}
                key={`solsList-item-${item.id}`}
              >
                <div className={styles.logsList_item_created}>
                  {$d(new Date(item.created), "M/d/yyyy h:mm a")}
                </div>
                <div className={styles.solsList_item_main}>
                  {item.actionUser} {item.test}{" "}
                  {item.actionType +
                    (item.actionType.charAt(item.actionType.length - 1) === "e"
                      ? "d"
                      : "ed")}{" "}
                  solicitation {item.sol?.title} {item.solId}
                  <div className={styles.solsList_item_actionData}>
                    {JSON.stringify(item.actionData)}
                  </div>
                </div>
                <div className={styles.solsList_item_actionType}>
                  {item.actionType}
                </div>
              </article>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
