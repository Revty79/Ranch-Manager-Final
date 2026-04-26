interface DateTimeInputParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  hasSeconds: boolean;
}

interface FormatOptions {
  includeSeconds?: boolean;
}

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseInputParts(value: string): DateTimeInputParts | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(INPUT_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const hasSeconds = typeof match[6] === "string";
  const second = Number(match[6] ?? "0");

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    hasSeconds,
  };
}

function toInputString(parts: DateTimeInputParts, options: FormatOptions = {}): string {
  const base = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(
    parts.minute,
  )}`;
  if (options.includeSeconds) {
    return `${base}:${pad(parts.second)}`;
  }

  return base;
}

function parsePartsFromFormatter(
  instant: Date,
  timeZone: string,
): DateTimeInputParts | null {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const partValue = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const part = formatted.find((entry) => entry.type === type)?.value;
    if (!part) {
      return null;
    }

    const parsed = Number(part);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");
  const hour = partValue("hour");
  const minute = partValue("minute");
  const second = partValue("second");

  if (
    year === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null ||
    second === null
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    hasSeconds: true,
  };
}

function getOffsetMinutesForInstant(
  instant: Date,
  timeZone: string,
): number | null {
  const zonedParts = parsePartsFromFormatter(instant, timeZone);
  if (!zonedParts) {
    return null;
  }

  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
    0,
  );

  return Math.round((zonedAsUtc - instant.getTime()) / 60_000);
}

export function formatDateTimeInputForTimeZone(
  instant: Date,
  timeZone: string,
  options: FormatOptions = {},
): string {
  const parts = parsePartsFromFormatter(instant, timeZone);
  if (!parts) {
    return "";
  }

  return toInputString(parts, options);
}

export function parseDateTimeInputInTimeZone(
  value: string | undefined,
  timeZone: string,
): Date | null {
  if (!value) {
    return null;
  }

  const inputParts = parseInputParts(value);
  if (!inputParts) {
    return null;
  }

  const localEpochAssumingUtc = Date.UTC(
    inputParts.year,
    inputParts.month - 1,
    inputParts.day,
    inputParts.hour,
    inputParts.minute,
    inputParts.second,
    0,
  );

  let guessEpoch = localEpochAssumingUtc;
  for (let index = 0; index < 6; index += 1) {
    const offsetMinutes = getOffsetMinutesForInstant(new Date(guessEpoch), timeZone);
    if (offsetMinutes === null) {
      return null;
    }

    const nextGuessEpoch = localEpochAssumingUtc - offsetMinutes * 60_000;
    if (nextGuessEpoch === guessEpoch) {
      const resolved = new Date(nextGuessEpoch);
      const normalized = formatDateTimeInputForTimeZone(resolved, timeZone, {
        includeSeconds: inputParts.hasSeconds,
      });
      const target = toInputString(inputParts, { includeSeconds: inputParts.hasSeconds });
      return normalized === target ? resolved : null;
    }

    guessEpoch = nextGuessEpoch;
  }

  const fallbackResolved = new Date(guessEpoch);
  const fallbackNormalized = formatDateTimeInputForTimeZone(fallbackResolved, timeZone, {
    includeSeconds: inputParts.hasSeconds,
  });
  const target = toInputString(inputParts, { includeSeconds: inputParts.hasSeconds });
  return fallbackNormalized === target ? fallbackResolved : null;
}
