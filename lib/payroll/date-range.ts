function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function resolvePayrollDateRange(
  fromInput?: string,
  toInput?: string,
): { from: string; to: string; fromDate: Date; toDateExclusive: Date } {
  const today = new Date();
  const defaultTo = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 13);

  const parsedFrom = fromInput ? new Date(`${fromInput}T00:00:00.000Z`) : defaultFrom;
  const parsedTo = toInput ? new Date(`${toInput}T00:00:00.000Z`) : defaultTo;

  const safeFrom = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
  const safeTo = Number.isNaN(parsedTo.getTime()) ? defaultTo : parsedTo;

  const fromDate = safeFrom <= safeTo ? safeFrom : safeTo;
  const toDate = safeFrom <= safeTo ? safeTo : safeFrom;
  const toDateExclusive = new Date(toDate);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  return {
    from: toDateOnlyString(fromDate),
    to: toDateOnlyString(toDate),
    fromDate,
    toDateExclusive,
  };
}
