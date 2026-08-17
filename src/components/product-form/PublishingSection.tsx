import { Store as StoreIcon, Tag } from "lucide-react";

export function PublishingSection() {
  return (
    <div className="px-4 py-4 border-b-8 border-gray-50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[15px] font-semibold text-gray-900">Publishing</span>
        <span className="text-sm text-blue-600 font-medium">Edit</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">2 channels</p>
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
        <StoreIcon size={16} className="text-gray-400" />
        Online Store, Point of Sale
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Tag size={16} className="text-gray-400" />
        No catalogs
      </div>
    </div>
  );
}
