import { Braces, MessageCircle, Heart, Pencil, Trash } from "lucide-react";
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

import styles from "./solActions.module.scss";

type SolActionsProps = {
  sol: Record<string, any>;
  refreshSols?: () => void;
  onEditSol?: (solId: string) => void;
};

const SolActions = ({ sol, refreshSols, onEditSol }: SolActionsProps) => {
  return (
    <div className={styles.solActions}>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Quick edit"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditSol) onEditSol(sol.id);
            }}
          >
            <Pencil />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Quick edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="hidden"
            size="icon"
            variant="ghost"
            aria-label="Comment"
          >
            <MessageCircle />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Comment</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label="JSON edit"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/solicitations/${sol.id}/jsonEdit`} target="_blank">
              <Braces />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">JSON edit</TooltipContent>
      </Tooltip>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete solicitation"
              >
                <Trash />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">Delete</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting solicitation <b>{sol.title}</b> {sol.id} cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await solModel.remove(sol.id);
                if (refreshSols) await refreshSols();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export { SolActions };
