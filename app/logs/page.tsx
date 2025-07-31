"use client";

import { List as CnList } from "@/components/cendien/list";
import { ScraperChart } from "./scraperChart";

import styles from "./page.module.scss";

export default function Page() {
  return (
    <>
      <div>
        <a>Scripts</a>
        <a>User</a>
      </div>
      <ScraperChart />
      <CnList
        className={styles.list}
        url="/api/scriptLogs"
        itemTemplate={(item) => (
          <article className={styles.list_item}>
            <div className={styles.list_item_created}>
              {new Date(item.created).toLocaleString()}
            </div>
            <div>{item.message}</div>
            <div className={styles.list_item_timeStr}>
              <var>{item.timeStr}</var>
            </div>
            <div className={styles.list_item_results}>
              <span className={styles.list_item_results_success}>
                <label>Success</label> <var>{item.successCount || 0}</var>
              </span>
              <span className={styles.list_item_results_fail}>
                <label>Fail</label> <var>{item.failCount || 0}</var>
              </span>
              <span className={styles.list_item_results_junk}>
                <label>Junk</label> <var>{item.junkCount || 0}</var>
              </span>
              <span className={styles.list_item_results_duplicates}>
                <label>Dups</label> <var>{item.dupCount || 0}</var>
              </span>
            </div>
          </article>
        )}
      />
    </>
  );
}
