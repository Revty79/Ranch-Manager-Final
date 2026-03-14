"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  createRanchReplyAction,
  type CommunicationActionState,
} from "@/lib/communication/actions";

const initialState: CommunicationActionState = {};

interface ReplyMessageFormProps {
  parentMessageId: string;
}

export function ReplyMessageForm({ parentMessageId }: ReplyMessageFormProps) {
  const [state, formAction] = useActionState(createRanchReplyAction, initialState);

  return (
    <form action={formAction} className="space-y-2 rounded-xl border bg-surface p-3">
      <input type="hidden" name="parentMessageId" value={parentMessageId} />
      <Textarea
        name="body"
        className="min-h-20"
        placeholder="Add a reply or update for this thread..."
        required
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
          {state.success ? (
            <p className="text-sm font-medium text-accent">{state.success}</p>
          ) : null}
        </div>
        <SubmitButton label="Reply" pendingLabel="Posting reply..." className="w-full md:w-fit" />
      </div>
    </form>
  );
}
