export interface TodayDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "Saturday, September 20" — long weekday + long month + numeric day.
 */
export function todayLabel(parts: TodayDateParts): string {
  const weekday = WEEKDAYS[parts.weekday] ?? WEEKDAYS[0];
  const month = MONTHS[parts.month - 1] ?? MONTHS[0];
  return `${weekday}, ${month} ${parts.day}`;
}