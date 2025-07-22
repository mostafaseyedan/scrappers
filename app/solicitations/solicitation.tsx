import { Eye, MessageCircle, StickyNote, Tag } from "lucide-react";
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
import { useState, Dispatch, SetStateAction } from "react";
import { solicitation as solModel } from "../models";
import { SolActions } from "./solActions";
import { cnStatuses } from "../config";
import { format as fnFormat } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import styles from "./solicitation.module.scss";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

type SolicitationProps = {
  className?: string;
  sol: Record<string, any>;
  expandedSolIds?: string[];
  setExpandedSolIds?: Dispatch<SetStateAction<string[]>>;
  refreshSols: () => void;
  onClickComment?: (solId: string) => void;
  onEditSol: (solId: string) => void;
  variant?: "compact" | "expanded";
};

const Solicitation = ({
  sol,
  className,
  expandedSolIds = [],
  setExpandedSolIds,
  refreshSols,
  onClickComment,
  onEditSol,
  variant = "compact",
}: SolicitationProps) => {
  const [expanded, setExpanded] = useState(false);
  const [cnStatus, setCnStatus] = useState(sol.cnStatus || "new");

  return (
    <div
      className={cn(
        className,
        styles.sol,
        expanded ? styles.sol__expanded : ""
      )}
      data-variant={variant}
    >
      <SolActions
        className={styles.sol_actions}
        expandedSolIds={expandedSolIds}
        setExpandedSolIds={setExpandedSolIds}
        sol={sol}
        refreshSols={refreshSols}
        onEditSol={onEditSol}
      />
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
        <div className={styles.sol_datesCol}>
          <div>
            <label>Closing</label>
            <span className={isWithinAWeek(sol.closingDate) ? "red" : ""}>
              {sol.closingDate &&
                fnFormat(new Date(sol.closingDate), "M/d/y haaa")}
            </span>
          </div>
          <div>
            <label>Published</label>
            <span className={isWithinAWeek(sol.publicationDate) ? "red" : ""}>
              {sol.publicationDate &&
                fnFormat(new Date(sol.publicationDate), "M/d/y haaa")}
            </span>
          </div>
          <div>
            <label>Extracted</label>
            <span>
              {sol.created && fnFormat(new Date(sol.created), "M/d/y h:mmaaa")}
            </span>
          </div>
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
      </div>
      <div className={styles.sol_statusCol}>
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
        <div className={styles.sol_iconCounts}>
          {Boolean(sol.keywords?.length) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={"ghost"} aria-label="Tags">
                  {sol.keywords.length || 0} <Tag />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sol.keywords.length || 0} Tags - {sol.keywords.join(", ")}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={"ghost"}
                aria-label="Comments"
                onClick={() => {
                  if (onClickComment) {
                    onClickComment(sol.id);
                  }
                }}
              >
                0 <MessageCircle />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Comments</TooltipContent>
          </Tooltip>
          {sol.cnNotes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={"ghost"} aria-label="Notes">
                  <StickyNote />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Notes - {sol.cnNotes.substr(0, 250)}
              </TooltipContent>
            </Tooltip>
          )}
          <Button variant={"ghost"} aria-label="Views">
            0 <Eye />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { Solicitation };
