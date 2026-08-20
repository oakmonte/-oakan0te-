import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ShoppingBag, Store, Upload, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/store/products_/newcomer")({
  component: ProductsNewcomer,
});

function ProductsNewcomer() {
  const [openDropdown, setOpenDropdown] = useState<"shopify" | "bumpa" | null>(null);

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Add your first product</h1>
      <p className="text-sm text-gray-500 mb-6">
        Create one manually, or bring in what you already have.
      </p>

      <div className="flex flex-col gap-3">
        <button className="flex items-center gap-3 border border-gray-200 rounded-2xl p-4 text-left oak-motion-control">
          <div className="p-2 rounded-full bg-gray-100">
            <Plus size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">Add new product</p>
            <p className="text-xs text-gray-500 mt-0.5">Create a listing from scratch.</p>
          </div>
        </button>

        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpenDropdown((v) => (v === "shopify" ? null : "shopify"))}
            className="w-full flex items-center gap-3 p-4 text-left oak-motion-control"
          >
            <div className="p-2 rounded-full bg-gray-100">
              <ShoppingBag size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Import from Shopify</p>
              <p className="text-xs text-gray-500 mt-0.5">Connect your store or upload a CSV.</p>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${openDropdown === "shopify" ? "rotate-180" : ""}`}
            />
          </button>
          {openDropdown === "shopify" && (
            <div className="border-t border-gray-100 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
              <button className="text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors duration-150">
                Connect Shopify directly
              </button>
              <button className="text-left px-4 py-3 text-sm hover:bg-gray-50 border-t border-gray-100 transition-colors duration-150">
                Upload Shopify CSV
              </button>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpenDropdown((v) => (v === "bumpa" ? null : "bumpa"))}
            className="w-full flex items-center gap-3 p-4 text-left oak-motion-control"
          >
            <div className="p-2 rounded-full bg-gray-100">
              <Store size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Import from Bumpa</p>
              <p className="text-xs text-gray-500 mt-0.5">Connect your store or upload a CSV.</p>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${openDropdown === "bumpa" ? "rotate-180" : ""}`}
            />
          </button>
          {openDropdown === "bumpa" && (
            <div className="border-t border-gray-100 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
              <button className="text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors duration-150">
                Connect Bumpa directly
              </button>
              <button className="text-left px-4 py-3 text-sm hover:bg-gray-50 border-t border-gray-100 transition-colors duration-150">
                Upload Bumpa CSV
              </button>
            </div>
          )}
        </div>

        <button className="flex items-center gap-3 border border-gray-200 rounded-2xl p-4 text-left oak-motion-control">
          <div className="p-2 rounded-full bg-gray-100">
            <Upload size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">Upload from anywhere else</p>
            <p className="text-xs text-gray-500 mt-0.5">Bring in a CSV from any other platform.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
