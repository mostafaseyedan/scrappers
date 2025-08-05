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
import { Textarea } from "@/components/ui/textarea";
import { useRef } from "react";
import { toast } from "sonner";
import { solicitation_comment as solCommentModel } from "../models";

type CreateCommentDialogProps = {
  solId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: () => void;
};

const CreateCommentDialog = ({
  solId,
  open,
  onOpenChange,
  onSubmitSuccess,
}: CreateCommentDialogProps) => {
  const form = useForm();
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  async function onSubmit(formValues: Record<string, any>) {
    const resp = await solCommentModel.post(solId, {
      body: formValues.body,
      attachments: [],
    });

    if (resp.error) {
      toast.error("Failed to create comment");
      return console.error("Error creating comment:", resp.error);
    }

    form.reset();
    onOpenChange(false);
    toast.success(`Comment created for solicitation ${solId} successfully`);
    onSubmitSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Comment for Solicitation</DialogTitle>
          <DialogDescription>{solId}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name="body"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} placeholder="Message" />
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

export { CreateCommentDialog };
