/** Personal calendar date; on the server always supply the user's timezone. */
export function localToday(now = new Date(), timezone = localTimezone()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Browser clock deadlines account for daylight-saving hour changes. */
export function nextLocalMidnight(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function localSlotDelay(time: string, now = new Date()): number {
  const [hour, minute] = time.split(":").map(Number);
  const slot = new Date(now);
  slot.setHours(hour ?? 0, minute ?? 0, 0, 0);
  return slot.getTime() - now.getTime();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
