"use client";

import { Datatable } from "au/components/Datatable";
import { contact as contactModel } from "@/app/models2";
import styles from "./page.module.scss";

export default function Page() {
  return (
    <div className={styles.page}>
      <Datatable model={contactModel} />
    </div>
  );
}
