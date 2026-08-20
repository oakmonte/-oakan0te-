import { Check, X } from "lucide-react";
import { CategoryNode } from "@/lib/categories";
import { VariantOption } from "@/components/product-form/VariantMatrixBuilder";

// Which parameters a category requires before a product in it can be
// published, keyed by category id anywhere in the chosen path — not just the
// leaf, since e.g. "Dresses" and "Shorts" both fall under "Clothing" and
// share the same requirements. Only Clothing is mapped so far; every other
// category shows an empty checklist until its own requirements are defined.
const NECESSITY_PARAMS: Record<string, string[]> = {
  clothing: ["Size", "Color", "Material"],
};

function paramsForCategory(categoryPath: CategoryNode[]): string[] {
  for (const node of categoryPath) {
    const params = NECESSITY_PARAMS[node.id];
    if (params) return params;
  }
  return [];
}

// Read-only by design — a seller can't check these off by hand, only by
// actually filling in the underlying field. Variant products carry Size/
// Color/Material as option names; regular products only have a dedicated
// field for Material today, so Size/Color always read unfilled there until
// this product type grows fields for them.
function isFilled(
  param: string,
  kind: "regular" | "variant",
  options: VariantOption[],
  material: string,
): boolean {
  if (kind === "variant") {
    return options.some(
      (o) => o.name.trim().toLowerCase() === param.toLowerCase() && o.values.length > 0,
    );
  }
  return param === "Material" && material.trim().length > 0;
}

export function NecessitiesSheet({
  categoryPath,
  kind,
  options,
  material,
  onClose,
}: {
  categoryPath: CategoryNode[];
  kind: "regular" | "variant";
  options: VariantOption[];
  material: string;
  onClose: () => void;
}) {
  const params = paramsForCategory(categoryPath);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Necessities
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {params.length === 0 ? (
          <p className="px-4 py-10 text-sm text-gray-400 text-center">
            {categoryPath.length === 0
              ? "Select a category to see what's required."
              : "No required details for this category yet."}
          </p>
        ) : (
          params.map((p) => {
            const filled = isFilled(p, kind, options, material);
            return (
              <div
                key={p}
                className="flex items-center justify-between px-4 py-4 border-b border-gray-50"
              >
                <span className="text-[15px] text-gray-900">{p}</span>
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    filled ? "bg-black border-black" : "border-gray-300"
                  }`}
                >
                  {filled && <Check size={13} className="text-white" />}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
