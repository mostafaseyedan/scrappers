import { Eye, Globe, Map, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, uidsToNames } from "@/lib/utils";
import {
  useContext,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { solicitation as solModel } from "../models";
import { cnStatuses } from "../config";
import { format as fnFormat, formatDistanceToNowStrict as fnDistance } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserContext } from "../userContext";

import styles from "./solicitation.module.scss";

function isExpiring(date: Date): boolean {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  date = new Date(date);
  return thirtyDaysFromNow > date;
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
  onSelectSol?: () => void;
  isSelected?: boolean;
  variant?: "compact" | "expanded";
};

const Solicitation = ({
  sol,
  className,
  refreshSols,
  onSelectSol,
  isSelected = false,
  variant = "compact",
}: SolicitationProps) => {
  const [expanded, setExpanded] = useState(false);
  const [cnStatus, setCnStatus] = useState(sol.cnStatus || "new");
  const userContext = useContext(UserContext);
  const getUser = userContext?.getUser;
  const [viewedBy, setViewedBy] = useState<string[]>([]);
  const aiScore = Number(sol.aiPursueScore);
  const aiScoreClass =
    aiScore >= 0.9 ? "green" : aiScore >= 0.7 ? "orange" : "red";

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

  return (
    <div
      className={cn(
        className,
        styles.sol,
        expanded ? styles.sol__expanded : "",
        isSelected ? styles.sol__selected : ""
      )}
      data-variant={variant}
      data-cn-status={cnStatus}
      onClick={onSelectSol}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.sol_contentCol}>
        <div className={styles.sol_title}>{sol.title}</div>

        <div className={styles.sol_midRow}>
          <div className={styles.sol_issuerRow}>
            {sol.location && (
              <span className={styles.sol_chip} title={sol.location}>
                <Map />
                {sol.location}
              </span>
            )}
            <a href={sol.siteUrl} target="_blank" rel="noopener noreferrer">
              <Globe />
              {sol.site}
            </a>
            {Boolean(sol.keywords?.length) && (
              <span>
                <Tag /> {sol.keywords.join(", ")}
              </span>
            )}
          </div>
          <div className={styles.sol_cnStatus} data-status={cnStatus} onClick={(e) => e.stopPropagation()}>
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
        </div>

        {/* Second row: dates on left, metrics/controls on right */}
        <div className={styles.sol_metaRow}>
          <div className={styles.sol_datesCol}>
            {sol.closingDate && (
              <div
                className={cn(
                  styles.sol_datePill,
                  isExpiring(sol.closingDate) ? styles.sol_datePill__urgent : ""
                )}
              >
                {fnFormat(new Date(sol.closingDate), dateFormat)}
                <span className={styles.sol_datePill_rel}>
                  {" • "}
                  {fnDistance(new Date(sol.closingDate), { addSuffix: false })} left
                </span>
              </div>
            )}
          </div>

          <div
            className={styles.sol_metaRight}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Views pill with tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={styles.sol_pill} aria-label="Views">
                  <Eye /> {sol.viewedBy?.length || 0}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Viewed By
                <br />
                {viewedBy?.length > 0 ? (
                  (() => {
                    const max = 5;
                    const shown = viewedBy.slice(0, max);
                    const extra = viewedBy.length - shown.length;
                    return (
                      <div>
                        {shown.map((v: string) => (
                          <div key={`viewedBy-${sol.id}-${v}`}>{v}</div>
                        ))}
                        {extra > 0 && <div>+{extra} more</div>}
                      </div>
                    );
                  })()
                ) : (
                  "No one yet"
                )}
              </TooltipContent>
            </Tooltip>

            {/* Pursue Score - unified pill size (render even when score is 0) */}
            {sol.aiPursueScore !== null && sol.aiPursueScore !== undefined && (
              <div
                className={cn(
                  styles.sol_pursuePill,
                  styles[`sol_pursuePill__${aiScoreClass}`]
                )}
              >
                {Math.round(aiScore * 100)}%
              </div>
            )}

            {/* Status dropdown moved to middle row */}
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
              {sol.externalLinks?.map((link: string, index: number) => (
                <a
                  key={`external-link-${sol.id}-${index}-${link}`}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
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
      {/* Right column removed to give title more space; metrics now in second row */}
    </div>
  );
};

export { Solicitation };
