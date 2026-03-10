"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import {
  resetTeamMemberPasswordAction,
  type TeamActionState,
} from "@/lib/team/actions";

const initialState: TeamActionState = {};

interface ResetMemberPasswordFormProps {
  membershipId: string;
  canReset: boolean;
}

export function ResetMemberPasswordForm({
  membershipId,
  canReset,
}: ResetMemberPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction] = useActionState(resetTeamMemberPasswordAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        if (!canReset) {
          event.preventDefault();
          return;
        }

        if (newPassword.length < 8) {
          event.preventDefault();
          setClientError("Password must be at least 8 characters.");
          return;
        }

        if (newPassword !== confirmPassword) {
          event.preventDefault();
          setClientError("Passwords do not match.");
          return;
        }

        setClientError(null);
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="space-y-1 text-sm">
        <span className="text-foreground-muted">New temporary password</span>
        <Input
          name="newPassword"
          type="password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          disabled={!canReset}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-foreground-muted">Confirm password</span>
        <Input
          type="password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter the password"
          disabled={!canReset}
          required
        />
      </label>
      {!canReset ? (
        <p className="text-sm text-foreground-muted">
          Managers cannot reset owner passwords.
        </p>
      ) : null}
      {clientError ? <p className="text-sm font-medium text-danger">{clientError}</p> : null}
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
      {canReset ? (
        <SubmitButton
          label="Reset password"
          pendingLabel="Resetting..."
          className="w-full md:w-fit"
        />
      ) : null}
    </form>
  );
}
