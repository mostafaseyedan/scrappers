"use client";

import { List as CnList } from "@/components/cendien/list";
import { ScraperChart } from "./scraperChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContext, useEffect } from "react";
import { format as $d } from "date-fns";
import { UserContext } from "@/app/userContext";
import { uidsToNames } from "@/lib/utils";

import styles from "./page.module.scss";

export default function Page() {
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;

  useEffect(() => {}, []);

  return (
    <>
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
                  {$d(item.created, "M/d/yyyy H:mm a")}
                </div>
                <div className={styles.logsList_item_main}>
                  {item.message}{" "}
                  <span className={styles.logsList_item_timeStr}>
                    <var>{item.timeStr}</var>
                  </span>
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
          <CnList
            className={styles.solsList}
            url="/api/solicitations/logs"
            onPreResults={async (logs) => {
              if (!getUser) return logs;

              // Get user name for each actionUserId
              const userIds = Array.from(
                new Set(logs.map((log) => log.actionUserId))
              );
              const userNames = await uidsToNames(userIds, getUser);
              const userMap = new Map(
                userIds.map((id, idx) => [id, userNames[idx]])
              );

              return logs
                .sort(
                  (a, b) =>
                    new Date(b.created).getTime() -
                    new Date(a.created).getTime()
                )
                .map((log) => ({
                  ...log,
                  actionUser: userMap.get(log.actionUserId) || log.actionUserId,
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
                  solicitation {item.solId}
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
    </>
  );
}
