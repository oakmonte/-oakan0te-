// Decides which database ids an edited product's options, values and variants
// keep, so that editing a product never changes the id of a variant the seller
// didn't remove.
//
// Variant ids are load-bearing outside the catalogue: offers.variant_id
// cascades on delete (an edit used to wipe every open offer on the product),
// and buyers' bags hold variant ids (an edit used to turn every bag line for
// the product "unavailable"). So product-save.ts no longer deletes and
// re-inserts the children on edit -- it asks this module which existing rows
// each incoming one IS, updates those in place, inserts only the genuinely new
// ones and deletes only the ones the seller removed.
//
// The original reason for rebuild-from-scratch was that naive diffing strands
// rows when an option is renamed or removed. The rules here handle those cases
// explicitly:
//
//   * An option is matched by name (case-insensitive). An incoming option no
//     existing name matches takes over the existing option at the same
//     position if that one is otherwise unclaimed -- that's a rename
//     ("Colour" -> "Color"), and its values and variants survive it.
//   * A value is matched by text within its option (case-insensitive, which
//     is also what the unique index enforces).
//   * A variant is matched by its full combination of (option, value). A
//     variant whose combination no longer exists -- because a value or a whole
//     option was removed, or a value was renamed (indistinguishable from
//     remove + add without row ids from the form) -- is deleted, along with its
//     offers. That is correct: it is no longer something a buyer can choose.
//   * Existing rows nothing claims are simply absent from the result; the
//     save RPC deletes whatever isn't listed.
//
// Pure, no Supabase: product-variant-ids.test.ts covers the matching rules.

export type ExistingOption = {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string }[];
};

export type ExistingVariant = {
  id: string;
  /** Normalized links (product_variant_options). */
  links: { optionId: string; valueId: string }[];
  /** The flat option1_* .. option3_* pairs, in slot order, nulls dropped.
   *  Only consulted for a variant with no links -- a half-finished create, or
   *  an old import -- so it can still be matched instead of replaced. */
  flat: { name: string; value: string }[];
  createdAt: string;
};

export type IncomingOption = { name: string; values: string[] };
export type IncomingRow = { options: { name: string; value: string }[] };

export type PlannedOption = {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string; position: number }[];
};

export type PlannedLinks = { optionId: string; valueId: string }[];

export type VariantIdPlan = {
  options: PlannedOption[];
  /** Same order as the incoming rows. */
  variants: { id: string; links: PlannedLinks }[];
};

const norm = (s: string) => s.trim().toLowerCase();

function comboKey(pairs: { optionId: string; value: string }[]): string {
  return pairs
    .map((p) => `${p.optionId}=${norm(p.value)}`)
    .sort()
    .join("\u0000");
}

/** Keys each existing variant by its combination in terms of EXISTING option
 *  ids. Returns null for a variant whose combination can't be read (a link or
 *  flat name pointing at an option that doesn't exist); that one is never
 *  matched. */
function existingKey(v: ExistingVariant, options: ExistingOption[]): string | null {
  if (v.links.length > 0) {
    const pairs: { optionId: string; value: string }[] = [];
    for (const l of v.links) {
      const opt = options.find((o) => o.id === l.optionId);
      const val = opt?.values.find((x) => x.id === l.valueId);
      if (!opt || !val) return null;
      pairs.push({ optionId: opt.id, value: val.value });
    }
    return comboKey(pairs);
  }
  const pairs: { optionId: string; value: string }[] = [];
  for (let slot = 0; slot < v.flat.length; slot++) {
    const f = v.flat[slot];
    const opt =
      options.find((o) => norm(o.name) === norm(f.name)) ??
      options.find((o) => o.position === slot);
    if (!opt) return null;
    pairs.push({ optionId: opt.id, value: f.value });
  }
  return comboKey(pairs);
}

export function planVariantIds(
  existingOptions: ExistingOption[],
  existingVariants: ExistingVariant[],
  incomingOptions: IncomingOption[],
  incomingRows: IncomingRow[],
  newId: () => string = () => crypto.randomUUID(),
): VariantIdPlan {
  // --- options: by name, then a rename at the same position ---------------
  const claimed = new Set<string>();
  const matched: (ExistingOption | undefined)[] = incomingOptions.map((o) => {
    const hit = existingOptions.find((e) => !claimed.has(e.id) && norm(e.name) === norm(o.name));
    if (hit) claimed.add(hit.id);
    return hit;
  });
  incomingOptions.forEach((_, i) => {
    if (matched[i]) return;
    const atSlot = existingOptions.find((e) => !claimed.has(e.id) && e.position === i);
    if (atSlot) {
      claimed.add(atSlot.id);
      matched[i] = atSlot;
    }
  });

  const options: PlannedOption[] = incomingOptions.map((o, i) => {
    const prev = matched[i];
    const usedValues = new Set<string>();
    return {
      id: prev?.id ?? newId(),
      name: o.name.trim(),
      position: i,
      values: o.values.map((value, vi) => {
        const hit = prev?.values.find(
          (x) => !usedValues.has(x.id) && norm(x.value) === norm(value),
        );
        if (hit) usedValues.add(hit.id);
        return { id: hit?.id ?? newId(), value, position: vi };
      }),
    };
  });

  // --- variants: by combination -------------------------------------------
  const optionFor = (name: string, fallbackIndex: number) =>
    options.find((o) => norm(o.name) === norm(name)) ?? options[fallbackIndex];

  const byKey = new Map<string, string[]>();
  for (const v of [...existingVariants].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = existingKey(v, existingOptions);
    if (key === null) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), v.id]);
  }

  const variants = incomingRows.map((r) => {
    const links: PlannedLinks = [];
    const pairs: { optionId: string; value: string }[] = [];
    r.options.forEach((ro, oi) => {
      const opt = optionFor(ro.name, oi);
      const val = opt?.values.find((x) => norm(x.value) === norm(ro.value));
      if (!opt || !val)
        throw new Error(`Variant value "${ro.value}" isn't one of its option's values`);
      links.push({ optionId: opt.id, valueId: val.id });
      pairs.push({ optionId: opt.id, value: ro.value });
    });
    const queue = byKey.get(comboKey(pairs));
    const reused = queue?.shift();
    return { id: reused ?? newId(), links };
  });

  return { options, variants };
}

/** The one variant a regular (option-less) product writes: its existing
 *  option-less variant if it has one, else its oldest variant (a product
 *  switched from variants to regular keeps one id rather than none), else new. */
export function planRegularVariantId(
  existingVariants: ExistingVariant[],
  newId: () => string = () => crypto.randomUUID(),
): string {
  const oldestFirst = [...existingVariants].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const plain = oldestFirst.find((v) => v.links.length === 0 && v.flat.length === 0);
  return (plain ?? oldestFirst[0])?.id ?? newId();
}
