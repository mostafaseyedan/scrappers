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
import { useRef } from "react";
import { toast } from "sonner";
import { DialogDescription } from "@radix-ui/react-dialog";

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
    console.log("onSubmit", formValues);

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
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
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
