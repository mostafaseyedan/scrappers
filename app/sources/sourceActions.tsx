import {
  Braces,
  ChevronsUpDown,
  ChevronsDownUp,
  EllipsisVertical,
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
import { source as sourceModel } from "../models";
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

import styles from "./sourceActions.module.scss";

type SourceActionsProps = {
  className?: string;
  source: Record<string, any>;
  refreshSols?: (options?: { list?: boolean; topBar?: boolean }) => void;
  onDeleteSuccess?: (options?: { list?: boolean; topBar?: boolean }) => void;
  onEditClick?: (sourceId: string) => void;
};

const SourceActions = ({
  className,
  source,
  refreshSols,
  onEditClick,
  onDeleteSuccess,
}: SourceActionsProps) => {
  return (
    <div className={cn(styles.sourceActions, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={styles.sourceActions_moreDropdown}>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              if (onEditClick) onEditClick(source.id);
            }}
          >
            <a>
              <Pencil />
              <span>Edit</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <a
                  className={styles.sourceActions_delete}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash />
                  Delete
                </a>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this source? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await sourceModel.remove({ id: source.id });
                      if (onDeleteSuccess) onDeleteSuccess();
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

export { SourceActions };
