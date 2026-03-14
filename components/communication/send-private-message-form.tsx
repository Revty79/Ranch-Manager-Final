"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  createPrivateMessageAction,
  type CommunicationActionState,
} from "@/lib/communication/actions";
import type { PrivateMessageMemberOption } from "@/lib/communication/queries";

const initialState: CommunicationActionState = {};

interface SendPrivateMessageFormProps {
  members: PrivateMessageMemberOption[];
  defaultRecipientMembershipId?: string | null;
}

function formatRole(role: PrivateMessageMemberOption["role"]): string {
  if (role === "seasonal_worker") return "seasonal worker";
  return role;
}

export function SendPrivateMessageForm({
  members,
  defaultRecipientMembershipId,
}: SendPrivateMessageFormProps) {
  const [state, formAction] = useActionState(createPrivateMessageAction, initialState);
  const activeMembers = members.filter((member) => member.isActive);
  if (!activeMembers.length) {
    return (
      <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
        No active team members are available for private messaging.
      </p>
    );
  }

  const hasDefault =
    defaultRecipientMembershipId != null &&
    activeMembers.some(
      (member) => member.membershipId === defaultRecipientMembershipId,
    );

  return (
    <form action={formAction} className="space-y-3">
      <FormFieldShell label="Send to">
        <select
          name="recipientMembershipId"
          defaultValue={hasDefault ? defaultRecipientMembershipId ?? "" : ""}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          required
        >
          <option value="" disabled>
            Select team member...
          </option>
          {activeMembers.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {member.fullName} ({formatRole(member.role)})
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell
        label="Private message"
        hint="Use this for one-on-one corrections, requests, and sensitive updates."
      >
        <Textarea
          name="body"
          className="min-h-20"
          placeholder="Quick private note with clear action and respectful context."
          required
        />
      </FormFieldShell>

      <div className="flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Send private message"
          pendingLabel="Sending private message..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
