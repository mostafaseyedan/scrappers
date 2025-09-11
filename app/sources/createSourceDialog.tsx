import {
  Dialog,
  DialogContent,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { source as sourceModel } from "../models";

import styles from "./createSourceDialog.module.scss";

type CreateSourceDialogProps = {
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

const CreateSourceDialog = ({
  open,
  onOpenChange,
  onSubmitSuccess,
}: CreateSourceDialogProps) => {
  const form = useForm({
    resolver: zodResolver(sourceModel.schema.db),
    defaultValues: {
      name: "",
      key: "",
      type: "",
      description: "",
      url: "",
    } as any,
  });

  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [formError, setFormError] = useState<string>("");

  async function onSubmit(values: Record<string, any>) {
    try {
      await sourceModel.post({
        data: values,
      });
    } catch (error) {
      console.error("Failed to create source:", error);
      setFormError("Failed to create source due to server error.");
      return;
    }

    setFormError("");
    onOpenChange(false);
    toast.success("Source created successfully");
    onSubmitSuccess?.();
  }

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        key: "",
        type: "",
        description: "",
        url: "",
      } as any);
      setFormError("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Source</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., City of Springfield" />
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
                    <Input {...field} placeholder="e.g., city-of-springfield" />
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
                    <Input {...field} placeholder="https://example.gov" />
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
                    <Textarea
                      {...field}
                      placeholder="Short description of the source"
                    />
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

export { CreateSourceDialog };
