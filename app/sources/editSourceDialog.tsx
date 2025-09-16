import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { source as sourceModel } from "../models";

import styles from "./createSourceDialog.module.scss";

/**
 * Dialog to edit a Source.
 * Mirrors the create dialog structure and the solicitation edit dialog pattern.
 */
export type EditSourceDialogProps = {
  sourceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: () => void;
};

const typeOptions = [
  "aggregator",
  "city",
  "county",
  "federal",
  "other",
  "school",
  "state",
  "water",
];

export const EditSourceDialog = ({
  sourceId,
  open,
  onOpenChange,
  onSubmitSuccess,
}: EditSourceDialogProps) => {
  const form = useForm();
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [formError, setFormError] = useState<string>("");

  // Load the existing source data when dialog opens and sourceId changes
  useEffect(() => {
    (async () => {
      if (open && sourceId) {
        try {
          const src = await sourceModel.getById({ id: sourceId });
          setFormError("");
          form.reset({
            name: src.name ?? "",
            key: src.key ?? "",
            type: src.type ?? "",
            url: src.url ?? "",
            description: src.description ?? "",
          } as any);
        } catch (err) {
          console.error("Failed to load source", err);
          setFormError("Failed to load source data.");
        }
      }
    })();
  }, [open, sourceId]);

  async function onSubmit(values: Record<string, any>) {
    if (!sourceId) return;

    let resp;
    try {
      resp = await sourceModel.patch({ id: sourceId, data: values });
    } catch (error: unknown) {
      resp = { error };
    }

    if (resp?.error) {
      toast.error("Failed to update source", resp.error as any);
      setFormError(String(resp.error));
      return console.error("Error updating source:", resp.error);
    }

    setFormError("");
    onOpenChange(false);
    toast.success(`Source ${sourceId} updated successfully`);
    onSubmitSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Source</DialogTitle>
          {sourceId && <DialogDescription>{sourceId}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" ref={saveButtonRef} className="hidden">
              Save
            </Button>
          </form>
        </Form>
        <DialogFooter>
          {formError && <div className={styles.formError}>{formError}</div>}
          <Button onClick={() => saveButtonRef.current?.click()}>Save</Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
