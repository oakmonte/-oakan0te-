import { ImageIcon } from "lucide-react";

export function MediaSection({
  mainImageUrl,
  onChange,
}: {
  mainImageUrl: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-4 py-5 border-b-8 border-gray-50">
      <div className="w-full flex flex-col items-center gap-2">
        <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
          {mainImageUrl ? (
            <img src={mainImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-gray-300" />
          )}
        </div>
        <span className="text-sm font-medium text-gray-900">Add images</span>
      </div>
      <input
        value={mainImageUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste an image URL for now"
        className="mt-3 w-full text-base text-center text-gray-500 outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
