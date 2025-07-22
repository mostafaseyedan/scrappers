import {
  Dialog,
  DialogContent,
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
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { DialogDescription } from "@radix-ui/react-dialog";

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

  useEffect(() => {
    (async () => {
      if (solId) {
        const sol = await solModel.getById(solId);
        form.reset({
          title: sol.title ?? "",
          issuingOrganization: sol.issuingOrganization ?? "",
          location: sol.location ?? "",
          description: sol.description ?? "",
          categories: sol.categories?.length ? sol.categories.join(", ") : "",
          keywords: sol.keywords?.length ? sol.keywords.join(", ") : "",
          cnNotes: sol.cnNotes ?? "",
        });
      }
    })();
  }, [solId]);

  async function onSubmit(formValues: Record<string, any>) {
    formValues.categories = formValues.categories
      .split(",")
      .map((cat: string) => cat.trim())
      .sort();
    formValues.categories = [...new Set(formValues.categories)];
    formValues.categories = formValues.categories.filter((cat: string) => cat);
    formValues.keywords = formValues.keywords
      .split(",")
      .map((kw: string) => kw.trim())
      .sort();
    formValues.keywords = [...new Set(formValues.keywords)];
    formValues.keywords = formValues.keywords.filter((kw: string) => kw);

    const resp = await solModel.patch(solId, formValues);

    if (resp.error) {
      console.error("Error updating solicitation:", resp.error);
      return;
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
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
            <FormField
              name="issuingOrganization"
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
            <FormField
              name="description"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
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
                      <Input {...field} />
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
                      <Textarea {...field} />
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
            <Button type="submit" ref={saveButtonRef} className="hidden">
              Save
            </Button>
          </form>
        </Form>
        <DialogFooter>
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
