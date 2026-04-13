import Image from "next/image";
import type { AnyIncident } from "@/lib/types";
import { INCIDENT_TYPE_COLORS, INCIDENT_TYPE_LABELS } from "@/lib/types";

interface BaseCardProps {
  incident: AnyIncident;
  /** Type-specific detail section rendered below the description */
  children?: React.ReactNode;
}

/**
 * Shared card shell used by all four incident type components.
 *
 * Renders: coloured left border, type badge, optional image, date,
 * title, description, company/country chips, and source links.
 * Type-specific metadata is injected via `children`.
 */
export function BaseCard({ incident, children }: BaseCardProps) {
  const colors = INCIDENT_TYPE_COLORS[incident.incident_type];
  const typeLabel = INCIDENT_TYPE_LABELS[incident.incident_type];

  const formattedDate = new Date(incident.date + "T00:00:00").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  return (
    <article
      data-incident-id={incident.id}
      className={`
        relative flex flex-col gap-4 rounded-lg border border-neutral-200
        bg-white shadow-sm transition-shadow hover:shadow-md
        dark:border-neutral-800 dark:bg-neutral-900
        border-l-4 ${colors.border}
      `}
    >
      {/* Optional image */}
      {incident.image_url && (
        <div className="relative h-44 w-full overflow-hidden rounded-t-lg">
          <Image
            src={incident.image_url}
            alt={incident.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 700px"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
        {/* Header row: date + type badge */}
        <div className="flex items-center justify-between gap-2">
          <time
            dateTime={incident.date}
            className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
          >
            {formattedDate}
          </time>
          <span
            className={`
              inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
              ${colors.badge} ${colors.badgeDark}
            `}
          >
            {typeLabel}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold leading-snug text-neutral-900 dark:text-neutral-50">
          {incident.title}
        </h2>

        {/* Description */}
        <div className="space-y-2">
          {incident.description.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
            >
              {para}
            </p>
          ))}
        </div>

        {/* Type-specific details */}
        {children && (
          <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-800/50">
            {children}
          </div>
        )}

        {/* Company + country chips */}
        {(incident.companies.length > 0 || incident.countries.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {incident.companies.slice(0, 4).map((company) => (
              <Chip key={company} label={company} variant="company" />
            ))}
            {incident.companies.length > 4 && (
              <Chip
                label={`+${incident.companies.length - 4} more`}
                variant="company"
              />
            )}
            {incident.countries.map((code) => (
              <Chip key={code} label={code} variant="country" />
            ))}
          </div>
        )}

        {/* Tags */}
        {incident.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {incident.tags.map((tag) => (
              <span
                key={tag}
                className="rounded text-xs text-neutral-400 dark:text-neutral-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Source links */}
        {incident.links.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
              Source:
            </span>
            {incident.links.slice(0, 3).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {new URL(url).hostname.replace("www.", "")}
              </a>
            ))}
            <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
              {incident.source}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Chip({
  label,
  variant,
}: {
  label: string;
  variant: "company" | "country";
}) {
  const base =
    "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium";
  const styles =
    variant === "company"
      ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
      : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 font-semibold";

  return <span className={`${base} ${styles}`}>{label}</span>;
}
