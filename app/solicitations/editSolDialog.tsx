import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useForm } from "react-hook-form";
import { solicitation as solModel } from "../models";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format as $d } from "date-fns";
import { sanitizeDateString, sanitizeUniqueCommaValues } from "@/lib/utils";

import styles from "./createSolDialog.module.scss";

type EditSolDialogProps = {
  solId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: () => void;
};

const EditSolDialog = ({
  solId,
  open,
  onOpenChange,
  onSubmitSuccess,
}: EditSolDialogProps) => {
  const form = useForm();
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (solId) {
        const sol = await solModel.getById({ id: solId });
        form.reset({
          title: sol.title ?? "",
          issuer: sol.issuer ?? "",
          location: sol.location ?? "",
          closingDate: sol.closingDate
            ? $d(sol.closingDate, "M/dd/yyyy h:mm a")
            : "",
          contactInfo: sol.contactInfo ?? "",
          publishDate: sol.publishDate
            ? $d(sol.publishDate, "M/dd/yyyy h:mm a")
            : "",
          description: sol.description ?? "",
          categories: sol.categories?.length ? sol.categories.join(", ") : "",
          keywords: sol.keywords?.length ? sol.keywords.join(", ") : "",
          cnNotes: sol.cnNotes ?? "",
        });
      }
    })();
  }, [solId]);

  async function onSubmit(formValues: Record<string, any>) {
    try {
      if (formValues.closingDate)
        formValues.closingDate = sanitizeDateString(formValues.closingDate);
    } catch (error) {
      console.error("Failed to create solicitation:", error);
      setFormError(
        "Invalid date format for Closing Date. Please use mm/dd/yyyy."
      );
      return;
    }

    try {
      if (formValues.publishDate)
        formValues.publishDate = sanitizeDateString(formValues.publishDate);
    } catch (error) {
      console.error("Failed to create solicitation:", error);
      setFormError(
        "Invalid date format for Published Date. Please use mm/dd/yyyy."
      );
      return;
    }

    formValues.categories = sanitizeUniqueCommaValues(formValues.categories);
    formValues.keywords = sanitizeUniqueCommaValues(formValues.keywords);

    const resp = await solModel.patch({ id: solId, data: formValues });

    if (resp.error) {
      toast.error("Failed to update solicitation");
      return console.error("Error updating solicitation:", resp.error);
    }

    onOpenChange(false);
    toast.success(`Solicitation ${solId} updated successfully`);
    onSubmitSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Edit Solicitation</DialogTitle>
          <DialogDescription>{solId}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name="title"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="issuer"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Issuer</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                name="location"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="closingDate"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Closing Date</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="mm/dd/yyyy" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                name="publishDate"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Published Date</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="mm/dd/yyyy" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <FormField
              name="contactNote"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Contact Note</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="name 555-555-5555 name@email.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              name="description"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              name="categories"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="category 1, category 2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              name="cnNotes"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              name="keywords"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="keyword 1, keyword 2, keyword 3"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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

export { EditSolDialog };
