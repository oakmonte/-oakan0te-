import { colorSwatchStyle } from "@/lib/color-options";
import { normalizeOptionName } from "@/lib/necessities";
import type { VariantOptionValue } from "./VariantMatrixBuilder";

/** A variant's name ("Canary / XL / Leather") with, when one of its options
 *  is a colour, a dot of that colour after it -- not everyone knows what
 *  "Canary" or "Terracotta" looks like, and seeing it makes picking the
 *  right photo for the variant easy. Inherits the caller's text styles. */
export function VariantName({ options }: { options: VariantOptionValue[] }) {
  const color = options.find((o) => normalizeOptionName(o.name) === "color")?.value;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{options.map((o) => o.value).join(" / ")}</span>
      {color && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-full border border-black/10"
          style={{ background: colorSwatchStyle(color) }}
        />
      )}
    </span>
  );
}
