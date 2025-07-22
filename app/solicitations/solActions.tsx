import {
  Braces,
  ChevronsUpDown,
  ChevronsDownUp,
  EllipsisVertical,
  MessageCircle,
  Heart,
  Pencil,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { solicitation as solModel } from "../models";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dispatch, SetStateAction } from "react";

import styles from "./solActions.module.scss";

type SolActionsProps = {
  className?: string;
  expandedSolIds?: string[];
  setExpandedSolIds?: Dispatch<SetStateAction<string[]>>;
  sol: Record<string, any>;
  refreshSols?: () => void;
  onEditSol?: (solId: string) => void;
};

const SolActions = ({
  className,
  expandedSolIds = [],
  setExpandedSolIds,
  sol,
  refreshSols,
  onEditSol,
}: SolActionsProps) => {
  return (
    <div className={cn(styles.solActions, className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={
              sol.cnLiked
                ? styles.solActions_likeButton__active
                : styles.solActions_likeButton
            }
            variant="ghost"
            size="icon"
            aria-label="Save solicitation"
            onClick={async (e) => {
              e.stopPropagation();
              await solModel.patch(sol.id, { cnLiked: !sol.cnLiked });
              if (refreshSols) await refreshSols();
            }}
          >
            <Heart />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Save to favorites</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={styles.solActions_moreDropdown}>
          <DropdownMenuItem
            onClick={() => {
              if (setExpandedSolIds) {
                setExpandedSolIds((prev) => {
                  return prev.includes(sol.id)
                    ? prev.filter((id) => id !== sol.id)
                    : [...prev, sol.id];
                });
              }
            }}
          >
            {!expandedSolIds.includes(sol.id) ? (
              <a>
                <ChevronsUpDown />
                <span>Expand</span>
              </a>
            ) : (
              <a>
                <ChevronsDownUp />
                <span>Collapse</span>
              </a>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              if (onEditSol) onEditSol(sol.id);
            }}
          >
            <a>
              <Pencil />
              <span>Quick edit</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href={`/solicitations/${sol.id}/jsonEdit`} target="_blank">
              <Braces />
              JSON edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <a className={styles.solActions_delete}>
                  <Trash />
                  Delete
                </a>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Solicitation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this solicitation? This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await solModel.delete(sol.id);
                      if (refreshSols) await refreshSols();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export { SolActions };
