import { addMinutes, format, parse } from "date-fns";

export const DAY_MAP: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}

/** "HH:mm" -> minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** minutes from midnight -> "HH:mm" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDisplayTime(time: string): string {
  try {
    const d = parse(time, "HH:mm", new Date());
    return format(d, "h:mm a");
  } catch {
    return time;
  }
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const d = parse(dateStr, "yyyy-MM-dd", new Date());
    return format(d, "d MMMM yyyy");
  } catch {
    return dateStr;
  }
}

export function addDuration(startTime: string, durationMinutes: number): string {
  const d = parse(startTime, "HH:mm", new Date());
  return format(addMinutes(d, durationMinutes), "HH:mm");
}

export function getDayName(dateStr: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  return DAY_MAP[d.getDay()];
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export type SlotInput = {
  workStartTime: string;
  workEndTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  durationMinutes: number;
  existingBookings: { startTime: string; endTime: string }[];
};

export type GeneratedSlot = {
  startTime: string;
  endTime: string;
  available: boolean;
};

/**
 * Generate appointment slots for a barber on a given day.
 * Marks slots unavailable when they overlap existing bookings or break times.
 */
export function generateSlots(input: SlotInput): GeneratedSlot[] {
  const {
    workStartTime,
    workEndTime,
    breakStartTime,
    breakEndTime,
    durationMinutes,
    existingBookings,
  } = input;

  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const breakStart = breakStartTime ? timeToMinutes(breakStartTime) : null;
  const breakEnd = breakEndTime ? timeToMinutes(breakEndTime) : null;

  const slots: GeneratedSlot[] = [];
  let cursor = workStart;

  while (cursor + durationMinutes <= workEnd) {
    const slotEnd = cursor + durationMinutes;

    // Skip if overlaps break
    const inBreak =
      breakStart !== null &&
      breakEnd !== null &&
      rangesOverlap(cursor, slotEnd, breakStart, breakEnd);

    const overlapsBooking = existingBookings.some((b) =>
      rangesOverlap(
        cursor,
        slotEnd,
        timeToMinutes(b.startTime),
        timeToMinutes(b.endTime)
      )
    );

    if (!inBreak) {
      slots.push({
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(slotEnd),
        available: !overlapsBooking,
      });
    }

    cursor += durationMinutes;
  }

  return slots;
}

export function isSalonOpenNow(
  workingDays: string[],
  openingTime: string,
  closingTime: string,
  now = new Date()
): boolean {
  const day = DAY_MAP[now.getDay()];
  if (!workingDays.includes(day)) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= timeToMinutes(openingTime) && mins < timeToMinutes(closingTime);
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
