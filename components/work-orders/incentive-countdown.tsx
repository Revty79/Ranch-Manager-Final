"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface IncentiveCountdownProps {
  incentivePayCents: number;
  incentiveEndsAt: Date | string | null;
  className?: string;
}

function toEndTimestamp(value: Date | string | null): number | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRemainingTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const time = [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");

  return days > 0 ? `${days}d ${time}` : time;
}

export function IncentiveCountdown({
  incentivePayCents,
  incentiveEndsAt,
  className,
}: IncentiveCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const incentiveEndTimestamp = useMemo(
    () => toEndTimestamp(incentiveEndsAt),
    [incentiveEndsAt],
  );

  useEffect(() => {
    if (!incentiveEndTimestamp || incentivePayCents <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [incentiveEndTimestamp, incentivePayCents]);

  if (incentivePayCents <= 0) {
    return (
      <p className={cn("text-xs text-foreground-muted", className)}>
        No incentive pay configured
      </p>
    );
  }

  if (!incentiveEndTimestamp) {
    return (
      <p className={cn("text-xs text-foreground-muted", className)}>
        Incentive {formatMoney(incentivePayCents)} has no countdown set
      </p>
    );
  }

  const remaining = incentiveEndTimestamp - now;
  if (remaining <= 0) {
    return (
      <p className={cn("text-xs font-medium text-danger", className)}>
        Incentive {formatMoney(incentivePayCents)} expired
      </p>
    );
  }

  return (
    <p className={cn("text-xs font-medium text-accent", className)}>
      Incentive {formatMoney(incentivePayCents)} active - {formatRemainingTime(remaining)} left
    </p>
  );
}

