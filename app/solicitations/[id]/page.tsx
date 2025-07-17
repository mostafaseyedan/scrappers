"use client";

import { Heart, Braces, Pencil } from "lucide-react";
import { db } from "@/lib/firebaseClient";
import { use, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { solicitation as solModel } from "@/app/models";

import styles from "./page.module.scss";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sol, setSol] = useState<Record<string, any> | undefined>();

  useEffect(() => {
    (async () => {
      document.title = `${id} | Cendien Recon`;

      const docRef = doc(db, "solicitations", id);
      const resp = await getDoc(docRef);
      setSol({ id, ...resp.data() });
    })();
  }, [id]);

  return (
    <div>
      {sol && (
        <div className={cn(styles.sol)}>
          <div className={styles.sol_actions}>
            <Button
              className={
                sol.cnLiked
                  ? styles.sol_actions_likeButton__active
                  : styles.sol_actions_likeButton
              }
              variant="ghost"
              size="icon"
              aria-label="Save solicitation"
              onClick={async (e) => {
                e.stopPropagation();
                await solModel.patch(sol.id, { cnLiked: !sol.cnLiked });
                // await refreshSols();
              }}
            >
              <Heart />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Quick edit">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" aria-label="JSON edit">
              <Link href={`/solicitations/${sol.id}/jsonEdit`}>
                <Braces />
              </Link>
            </Button>
          </div>
          <div className={styles.sol_contentCol}>
            <span className={styles.sol_title}>{sol.title}</span>
            <div className={styles.sol_issuerRow}>
              <span>{sol.location}</span>
              <span>/</span>
              <span>{sol.issuingOrganization}</span>
            </div>
            <div className={styles.sol_sourceRow}>
              <span>{sol.id}</span>
              <span>/</span>
              <a href={sol.siteUrl} target="_blank">
                <span>{sol.siteId}</span> <span>{sol.site}</span>
              </a>
            </div>
            <div className={styles.sol_descriptionBox}>
              <span className={styles.sol_description}>{sol.description}</span>

              <div className={styles.sol_externalLinks}>
                <label>External Links</label>
                <div>
                  {sol.externalLinks?.map((link: string) => (
                    <div key={`external-link-${link}`}>
                      <a href={link} target="_blank">
                        {link}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.sol_categories}>
              <label>Categories</label>
              {sol.categories?.map((category: string) => (
                <span
                  key={`category-${category}`}
                  className={styles.sol_category}
                >
                  {category}
                </span>
              ))}
            </div>
            <div className={styles.sol_keywords}>
              <label>Keywords</label>
              {sol.keywords?.map((keyword: string) => (
                <span
                  key={`sol-keyword-${keyword}`}
                  className={styles.sol_keyword}
                >
                  {keyword}
                </span>
              ))}
            </div>
            <div>
              <label>Documents</label>
              <pre className="json">
                {JSON.stringify(sol.documents, null, 2)}
              </pre>
            </div>
            <div>
              <label>Notes</label>
              <span>{sol.cnNotes}</span>
            </div>
            <div>
              <label>Source Data</label>
              <pre className="json">
                {JSON.stringify(sol.siteData, null, 2)}
              </pre>
            </div>
            <div>
              <label>Viewed By</label>
            </div>
          </div>
          <div className={styles.sol_datesCol}>
            <label>Our Status</label>
            <div className={styles.sol_ourStatus}>
              <Select
                defaultValue={sol.cnStatus || "new"}
                onValueChange={(value) => {
                  solModel.patch(sol.id, { cnStatus: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="New" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="ignore">Ignore</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <label>Status</label>
            <span>Active</span>
            <label>Closing Date</label>
            <span className={isWithinAWeek(sol.closingDate) ? "red" : ""}>
              {sol.closingDate.toDate().toLocaleString()}
            </span>
            <label>Published Date</label>
            <span className={isWithinAWeek(sol.publicationDate) ? "red" : ""}>
              {sol.publicationDate.toDate().toLocaleString()}
            </span>
            <label>Extracted Date</label>
            <span>{sol.created.toDate().toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
