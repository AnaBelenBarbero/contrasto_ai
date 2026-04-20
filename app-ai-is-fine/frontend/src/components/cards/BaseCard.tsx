import Image from "next/image";
import type { AnyIncident, IncidentType } from "@/lib/types";
import { INCIDENT_TYPE_COLORS, INCIDENT_TYPE_LABELS } from "@/lib/types";

interface BaseCardProps {
  incident: AnyIncident;
  /** Type-specific detail section rendered below the description */
  children?: React.ReactNode;
  /** When true, hides the company/country chips and hashtag rows */
  hideChipsAndTags?: boolean;
}

/** Top-accent colour strip per incident type. */
const ACCENT_CLASSES: Record<IncidentType, string> = {
  ai_harm: "bg-rose-500",
  layoff: "bg-amber-500",
  regulatory: "bg-blue-500",
  //model_failure: "bg-violet-500",
};

/**
 * Shared card shell used by all four incident type components.
 *
 * Design: coloured 3 px top accent, optional image, date, title, description,
 * metadata block, company/country chips, source links.
 * No left border — the center spine provides type context in two-column mode.
 */
export function BaseCard({ incident, children, hideChipsAndTags = false }: BaseCardProps) {
  const colors = INCIDENT_TYPE_COLORS[incident.incident_type];
  const typeLabel = INCIDENT_TYPE_LABELS[incident.incident_type];
  const accent = ACCENT_CLASSES[incident.incident_type];

  const formattedDate = new Date(incident.date + "T00:00:00").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  return (
    <article
      data-incident-id={incident.id}
      className="
        relative flex flex-col overflow-hidden rounded-xl
        bg-white ring-1 ring-black/[0.07]
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        dark:bg-neutral-900 dark:ring-white/[0.07]
      "
    >
      {/* Coloured top accent strip */}
      <div className={`h-[3px] w-full flex-shrink-0 ${accent}`} />

      {/* Optional image */}
      {incident.image_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <Image
            src={incident.image_url}
            alt={incident.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 560px"
          />
          {/* Fade at bottom for text legibility when image is close to content */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/70 dark:from-neutral-900/70" />
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
        {/* Date + type badge */}
        <div className="flex items-center justify-between gap-2">
          <time
            dateTime={incident.date}
            className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
          >
            {formattedDate}
          </time>
          <span
            className={`
              inline-flex items-center rounded-full px-2 py-0.5
              text-[10px] font-bold uppercase tracking-wide
              ${colors.badge} ${colors.badgeDark}
            `}
          >
            {typeLabel}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-[15px] font-bold leading-snug text-neutral-900 dark:text-neutral-50">
          {incident.title}
        </h2>

        {/* Description */}
        <div className="space-y-1.5">
          {incident.description.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
            >
              {para}
            </p>
          ))}
        </div>

        {/* Type-specific metadata block */}
        {children && (
          <div className="rounded-lg bg-neutral-50 px-3 py-2.5 ring-1 ring-black/[0.04] dark:bg-neutral-800/60 dark:ring-white/[0.04]">
            {children}
          </div>
        )}

        {/* Company + country chips */}
        {!hideChipsAndTags && (incident.companies.length > 0 || incident.countries.length > 0) && (
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
        {!hideChipsAndTags && incident.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {incident.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-neutral-400 dark:text-neutral-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Source links */}
        {incident.links.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              Source:
            </span>
            {incident.links.slice(0, 3).map((url, i) => {
              let hostname = url;
              try {
                hostname = new URL(url).hostname.replace("www.", "");
              } catch {
                // keep raw url as fallback
              }
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {hostname}
                </a>
              );
            })}
            {/* Display incident source info as plain text 
            <span className="ml-auto text-[11px] text-neutral-400 dark:text-neutral-500">
              {incident.source}
            </span>
            */}
       
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
    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium";
  const styles =
    variant === "company"
      ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-semibold";

  return <span className={`${base} ${styles}`}>{label}</span>;
}
