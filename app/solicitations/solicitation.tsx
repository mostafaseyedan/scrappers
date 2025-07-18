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
import { useState } from "react";
import { solicitation as solModel } from "../models";
import { SolActions } from "./solActions";
import { cnStatuses } from "../config";

import styles from "./solicitation.module.scss";
import { set } from "zod";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

type SolicitationProps = {
  sol: Record<string, any>;
  refreshSols: () => void;
  onEditSol: (solId: string) => void;
};

const Solicitation = ({ sol, refreshSols, onEditSol }: SolicitationProps) => {
  const [expanded, setExpanded] = useState(false);
  const [cnStatus, setCnStatus] = useState(sol.cnStatus || "new");

  return (
    <div className={cn(styles.sol, expanded ? styles.sol__expanded : "")}>
      <SolActions sol={sol} refreshSols={refreshSols} onEditSol={onEditSol} />
      <div className={styles.sol_contentCol}>
        <Link
          className={styles.sol_title}
          href={`/solicitations/${sol.id}`}
          target="_blank"
        >
          {sol.title}
        </Link>
        <div className={styles.sol_issuerRow}>
          <span>{sol.location}</span>
          <span>/</span>
          <span>{sol.issuingOrganization}</span>
        </div>
        <div className={styles.sol_sourceRow}>
          <a href={sol.siteUrl} target="_blank">
            <span>{sol.site}</span>_<span>{sol.siteId}</span>
          </a>
        </div>
        <div
          className={styles.sol_descriptionBox}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={styles.sol_description}>{sol.description}</span>

          <div className={styles.sol_externalLinks}>
            <label>External Links</label>
            <div>
              {sol.externalLinks?.map((link: string) => (
                <a key={`external-link-${link}`} href={link} target="_blank">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.sol_categories}>
          <label>Categories</label>
          {sol.categories?.map((category: string) => (
            <span
              key={`sol-${sol.id}-category-${category}`}
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
              key={`sol-${sol.id}-keyword-${keyword}`}
              className={styles.sol_keyword}
            >
              {keyword}
            </span>
          ))}
        </div>
        <div>
          <label>Notes</label>
          <span>{sol.cnNotes}</span>
        </div>
        <div>
          <label>Comments (0)</label>
        </div>
        <div>
          <label>Viewed By</label>
        </div>
      </div>
      <div className={styles.sol_datesCol}>
        <label>Our Status</label>
        <div className={styles.sol_ourStatus} data-status={cnStatus}>
          <Select
            defaultValue={sol.cnStatus || "new"}
            onValueChange={async (value) => {
              await solModel.patch(sol.id, { cnStatus: value });
              setCnStatus(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="New" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {cnStatuses &&
                  Object.entries(cnStatuses).map(([value, label]) => (
                    <SelectItem
                      className={styles[`sol_statusItem_${value}`]}
                      key={value}
                      value={value}
                    >
                      {label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <label>Status</label>
        <span>Active</span>
        <label>Closing Date</label>
        <span className={isWithinAWeek(sol.closingDate) ? "red" : ""}>
          {sol.closingDate && new Date(sol.closingDate).toLocaleString()}
        </span>
        <label>Published Date</label>
        <span className={isWithinAWeek(sol.publicationDate) ? "red" : ""}>
          {sol.publicationDate &&
            new Date(sol.publicationDate).toLocaleString()}
        </span>
        <label>Extracted Date</label>
        <span>{sol.created && new Date(sol.created).toLocaleString()}</span>
      </div>
    </div>
  );
};

export { Solicitation };
