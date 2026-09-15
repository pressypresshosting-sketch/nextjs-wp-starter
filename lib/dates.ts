import { site } from "@/lib/site";

/** WordPress `date_gmt` has no zone designator; append Z to make it real UTC. */
export function gmtToIso(dateGmt: string): string {
  return dateGmt.endsWith("Z") ? dateGmt : `${dateGmt}Z`;
}

const longDate = new Intl.DateTimeFormat(site.locale, {
  timeZone: site.timeZone,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat(site.locale, {
  timeZone: site.timeZone,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const weekdayDate = new Intl.DateTimeFormat(site.locale, {
  timeZone: site.timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeOfDay = new Intl.DateTimeFormat(site.locale, {
  timeZone: site.timeZone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type DateStyle = "long" | "short" | "weekday" | "datetime";

export function formatDate(iso: string, style: DateStyle = "long"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  switch (style) {
    case "short":
      return shortDate.format(date);
    case "weekday":
      return weekdayDate.format(date);
    case "datetime":
      return `${longDate.format(date)}, ${timeOfDay.format(date)} ${site.timeZone}`;
    default:
      return longDate.format(date);
  }
}

/** RFC 822 date for RSS. */
export function formatRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}
