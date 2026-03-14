"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createRanchMessageAction,
  type CommunicationActionState,
} from "@/lib/communication/actions";

const initialState: CommunicationActionState = {};

export function CreateMessageForm() {
  const [state, formAction] = useActionState(createRanchMessageAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Subject">
        <Input name="title" placeholder="South pasture fence status" required />
      </FormFieldShell>

      <FormFieldShell label="Priority">
        <select
          name="priority"
          defaultValue="normal"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </FormFieldShell>

      <FormFieldShell
        label="Message"
        className="md:col-span-2"
        hint="Keep it operational: context, ask, and what needs follow-up."
      >
        <Textarea
          name="body"
          placeholder="Crew, please move the north herd to Cell 3 after lunch and confirm water checks."
          className="min-h-24"
          required
        />
      </FormFieldShell>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Post message"
          pendingLabel="Posting message..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
