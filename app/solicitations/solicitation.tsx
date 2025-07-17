import { Braces, Heart, Pencil } from "lucide-react";
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
import { useState } from "react";
import { solicitation as solModel } from "../models";

import styles from "./solicitation.module.scss";

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

  return (
    <div
      className={cn(styles.sol, expanded ? styles.sol__expanded : "")}
      onClick={() => setExpanded((v) => !v)}
    >
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
            await refreshSols();
          }}
        >
          <Heart />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Quick edit"
          onClick={(e) => {
            e.stopPropagation();
            onEditSol(sol.id);
          }}
        >
          <Pencil />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="JSON edit"
          onClick={(e) => e.stopPropagation()}
        >
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
          <Link href={`/solicitations/${sol.id}`} target="_blank">
            {sol.id}
          </Link>
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
            <span key={`category-${category}`} className={styles.sol_category}>
              {category}
            </span>
          ))}
        </div>
        <div className={styles.sol_keywords}>
          <label>Keywords</label>
          {sol.keywords?.map((keyword: string) => (
            <span key={`sol-keyword-${keyword}`} className={styles.sol_keyword}>
              {keyword}
            </span>
          ))}
        </div>
        <div>
          <label>Notes</label>
          <span>{sol.cnNotes}</span>
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
            onValueChange={async (value) => {
              await solModel.patch(sol.id, { cnStatus: value });
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
