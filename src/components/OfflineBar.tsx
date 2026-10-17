import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/offline-app";

/** A slim bar while there's no connection: saved screens still open, and this
 *  says why some things (saving, paying, messages) won't work right now. */
export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="oak-motion-fade fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-[#111827] px-4 pb-2 text-[12.5px] font-medium text-white"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <WifiOff size={14} className="shrink-0" />
      You're offline. Saved screens still work; changes need internet.
    </div>
  );
}
