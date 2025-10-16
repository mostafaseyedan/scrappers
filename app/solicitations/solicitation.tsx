import {
  CalendarClock,
  Clock,
  Eye,
  FileText,
  Globe,
  MapPin,
  MessageCircle,
  StickyNote,
  Tag,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, uidsToNames } from "@/lib/utils";
import Link from "next/link";
import {
  useContext,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { solicitation as solModel } from "../models";
import { SolActions } from "./solActions";
import { cnStatuses, cnTypes } from "../config";
import { format as fnFormat } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserContext } from "../userContext";

import styles from "./solicitation.module.scss";

function isWithinAWeek(date: Date): boolean {
  const now = new Date();
  const oneWeekFromNow = new Date(now);
  oneWeekFromNow.setDate(now.getDate() + 7);
  return date >= now && date <= oneWeekFromNow;
}

const dateFormat = "MMM d y";

type SolicitationProps = {
  className?: string;
  sol: Record<string, any>;
  expandedSolIds?: string[];
  setExpandedSolIds?: Dispatch<SetStateAction<string[]>>;
  refreshSols: (options?: {
    list?: boolean;
    topBar?: boolean;
  }) => Promise<void>;
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
  const [cnType, setCnType] = useState(sol.cnType || "-");
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;
  const [viewedBy, setViewedBy] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (getUser) {
      uidsToNames(sol.viewedBy, getUser).then((names) => {
        if (isMounted) setViewedBy(names);
      });
    } else {
      setViewedBy([]);
    }
    return () => {
      isMounted = false;
    };
  }, [sol.viewedBy, getUser]);

  (sol.viewedBy || []).map(async (uid: string) => {
    if (getUser) {
      const user = await getUser(uid);
      return user ? user.displayName || user.email || uid : uid;
    }
    return uid;
  });

  useEffect(() => {
    setCnStatus(sol.cnStatus);
  }, [sol.cnStatus]);

  useEffect(() => {
    setCnType(sol.cnType);
  }, [sol.cnType]);

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
        onDeleteSuccess={refreshSols}
        onEditSol={onEditSol}
      />
      <div className={styles.sol_contentCol}>
        <Link className={styles.sol_title} href={`/solicitations/${sol.id}`}>
          {sol.title}
        </Link>
        <div className={styles.sol_issuerRow}>
          {sol.issuer && <span>{sol.issuer}</span>}
          {sol.location && (
            <span>
              <MapPin />
              {sol.location}
            </span>
          )}
          <a href={sol.siteUrl} target="_blank">
            <Globe />
            {sol.site}
          </a>
          {Boolean(sol.keywords?.length) && (
            <span>
              <Tag /> {sol.keywords.join(", ")}
            </span>
          )}
        </div>
        <div className={styles.sol_datesCol}>
          {sol.closingDate && (
            <div>
              <label>
                <Clock />
                Closing
              </label>
              <span className={isWithinAWeek(sol.closingDate) ? "red" : ""}>
                {fnFormat(new Date(sol.closingDate), dateFormat)}
              </span>
            </div>
          )}
          {sol.publishDate && (
            <div>
              <label>
                <CalendarClock /> Published
              </label>
              <span className={isWithinAWeek(sol.publishDate) ? "red" : ""}>
                {fnFormat(new Date(sol.publishDate), dateFormat)}
              </span>
            </div>
          )}
          {sol.created && (
            <div>
              <label>
                <FileText />
                Extracted
              </label>
              <span>{fnFormat(new Date(sol.created), dateFormat)}</span>
            </div>
          )}
        </div>
        <div
          className={styles.sol_descriptionBox}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={styles.sol_description}>{sol.description}</span>
          <div className={styles.sol_externalLinks}>
            <label>External Links</label>
            <div>
              {sol.externalLinks?.map((link: string, index: number) => (
                <a
                  key={`external-link-${sol.id}-${index}-${link}`}
                  href={link}
                  target="_blank"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.sol_categories}>
          <label>Categories</label>
          {sol.categories?.map((category: string, index: number) => (
            <span
              key={`sol-${sol.id}-${index}-category-${category}`}
              className={styles.sol_category}
            >
              {category}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.sol_statusCol}>
        <div className={styles.sol_iconCounts}>
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
                {sol.commentsCount} <MessageCircle />
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={"ghost"} aria-label="Views">
                {sol.viewedBy?.length || 0} <Eye />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Viewed By
              <br />
              {viewedBy?.length > 0
                ? viewedBy.map((v: string) => (
                    <div key={`viewedBy-${sol.id}-${v}`}>{v}</div>
                  ))
                : "No one yet"}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={styles.sol_cnStatus} data-status={cnStatus}>
          <Select
            value={cnStatus}
            onValueChange={async (value) => {
              await solModel.patch({ id: sol.id, data: { cnStatus: value } });
              setCnStatus(value);
              await refreshSols({ list: false });
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
        <div className={styles.sol_cnType}>
          <Select
            value={cnType}
            onValueChange={async (value) => {
              await solModel.patch({ id: sol.id, data: { cnType: value } });
              setCnType(value);
              await refreshSols({ list: false });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem
                  key={"default"}
                  value={"-"}
                  className={styles[`sol_typeItem_default`]}
                >
                  -
                </SelectItem>
                {cnTypes.map((type) => (
                  <SelectItem
                    key={type.key}
                    value={type.key}
                    className={styles[`sol_typeItem_${type.key}`]}
                  >
                    {type.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export { Solicitation };
