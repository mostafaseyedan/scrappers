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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useRef } from "react";
import { toast } from "sonner";
import { solicitation as solModel } from "../models";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  randomString,
  sanitizeDateString,
  sanitizeUniqueCommaValues,
} from "@/lib/utils";

import styles from "./createSolDialog.module.scss";

type CreateSolDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: () => void;
};

const CreateSolDialog = ({
  open,
  onOpenChange,
  onSubmitSuccess,
}: CreateSolDialogProps) => {
  const form = useForm({
    resolver: zodResolver(solModel.schema.postForm),
  });
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [formError, setFormError] = useState<string>("");

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
      if (formValues.publicationDate)
        formValues.publicationDate = sanitizeDateString(
          formValues.publicationDate
        );
    } catch (error) {
      console.error("Failed to create solicitation:", error);
      setFormError(
        "Invalid date format for Published Date. Please use mm/dd/yyyy."
      );
      return;
    }

    formValues.categories = sanitizeUniqueCommaValues(formValues.categories);
    formValues.keywords = sanitizeUniqueCommaValues(formValues.keywords);
    formValues.site = "manual";
    formValues.siteId = `random-${randomString(32)}`;

    if (formValues.externalLink)
      formValues.externalLinks = [formValues.externalLink];

    try {
      await solModel.post("", formValues, "");
    } catch (error) {
      console.error("Failed to create solicitation:", error);
      setFormError("Failed to create solicitation due to server error.");
      return;
    }

    setFormError("");
    onOpenChange(false);
    toast.success(`Solicitation created successfully`);
    onSubmitSuccess?.();
  }

  useEffect(() => {
    if (open) {
      form.reset();
      setFormError("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Solicitation</DialogTitle>
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
                name="publicationDate"
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
              name="externalLink"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>External Link</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} placeholder="category1, category2" />
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
                        placeholder="keyword1, keyword2, keyword3"
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

export { CreateSolDialog };
