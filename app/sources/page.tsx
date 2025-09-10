"use client";

import { format as $d } from "date-fns";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@/app/userContext";
import { Button } from "@/components/ui/button";
import { CreateSourceDialog } from "./createSourceDialog";
import { List as CnList, type ListHandle } from "@/components/cendien/list";
import { SourceActions } from "./sourceActions";

import styles from "./page.module.scss";

export default function Page() {
  const userContext = useContext(UserContext);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const listRef = useRef<ListHandle>(null);

  useEffect(() => {}, []);

  return (
    <div className={styles.page}>
      <CnList
        ref={listRef}
        className={styles.sourcesList}
        url="/api/sources"
        headerTemplate={
          <Button onClick={() => setOpenCreateDialog(true)}>
            Create Source
          </Button>
        }
        itemTemplate={(item) => (
          <div className={styles.sourceItem}>
            <SourceActions source={item} />
            <div className={styles.sourceItem_main}>
              <span className={styles.sourceItem_name}>{item.name}</span>
              <a
                className={styles.sourceItem_url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.url}
              </a>
              <span className={styles.sourceItem_created}>
                {$d(item.created, "M/d/yyyy h:mm a")} by {item.authorId}
              </span>
            </div>
            <span className={styles.sourceItem_type}>{item.type}</span>
          </div>
        )}
      />

      <CreateSourceDialog
        open={openCreateDialog}
        onOpenChange={setOpenCreateDialog}
        onSubmitSuccess={() => {
          listRef.current?.refresh();
        }}
      />
    </div>
  );
}
