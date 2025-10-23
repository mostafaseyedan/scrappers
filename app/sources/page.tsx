"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Datatable } from "au/components/Datatable";
import {
  issuer as issuerModel,
  location as locationModel,
  site as siteModel,
} from "@/app/models2";

import styles from "./page.module.scss";

export default function Page() {
  return (
    <div className={styles.page}>
      <Tabs defaultValue="issuers">
        <TabsList>
          <TabsTrigger value="issuers">Issuers</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
        </TabsList>
        <TabsContent value="issuers">
          <Datatable model={issuerModel} defaultLimit={10} />
        </TabsContent>
        <TabsContent value="locations">
          <Datatable model={locationModel} defaultLimit={10} />
        </TabsContent>
        <TabsContent value="sites">
          <Datatable model={siteModel} defaultLimit={10} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
