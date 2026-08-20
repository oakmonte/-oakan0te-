import { LucideIcon } from "lucide-react";

export function ComingSoonState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="px-4 py-16 flex flex-col items-center gap-3 text-center animate-in fade-in duration-300">
      <div className="p-3 rounded-full bg-gray-100">
        <Icon size={20} className="text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-1 max-w-[240px]">{description}</p>
      </div>
    </div>
  );
}
