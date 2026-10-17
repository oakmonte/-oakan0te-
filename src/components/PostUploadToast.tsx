import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Check, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { POSTS_NEEDED } from "@/hooks/use-store-setup-status";
import { endSetupPostGoal, inSetupPostGoal } from "@/lib/setup-post-goal";
import {
  subscribePostUpload,
  getPostUploadSnapshot,
  retryPostUpload,
  dismissPostUpload,
} from "@/lib/post-upload";
import { GLASS_RIM, glassDark } from "@/lib/liquid-glass";

const LABELS = {
  uploading: { published: "Posting…", draft: "Saving to drafts…" },
  success: { published: "Posted", draft: "Saved to drafts" },
  error: { published: "Couldn't post", draft: "Couldn't save draft" },
};

/** Mounted once in __root.tsx so it survives navigating away from the
 *  publish page — the upload it's reporting on keeps running in the
 *  background regardless of what route the seller is on. See post-upload.ts. */
export function PostUploadToast() {
  const state = useSyncExternalStore(subscribePostUpload, getPostUploadSnapshot, () => null);
  const nudge = useSetupPostNudge(
    state?.status === "success" && state.kind === "published" ? state.postId : null,
  );
  if (nudge) return nudge;
  if (!state) return null;

  return (
    <div
      className={`oak-motion-fade fixed left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-white max-w-[92vw] ${GLASS_RIM}`}
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        ...glassDark,
        // Denser than the base recipe: a toast has to be read at a glance
        // over whatever is behind it, including white screens.
        background: "rgba(24,26,30,0.78)",
      }}
    >
      {state.status === "uploading" && (
        <>
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>{LABELS.uploading[state.kind]}</span>
        </>
      )}
      {state.status === "success" && (
        <>
          <Check size={15} className="text-green-400 shrink-0" />
          <span>{LABELS.success[state.kind]}</span>
        </>
      )}
      {state.status === "error" && (
        <>
          <span className="truncate">{LABELS.error[state.kind]}</span>
          <button
            type="button"
            onClick={retryPostUpload}
            className="font-semibold underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={dismissPostUpload}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}

/** After a post that started from the setup checklist's "Post content" step
 *  lands, a card that stays until tapped: "Post another" while the store is
 *  short of POSTS_NEEDED, "Back to setup" once it isn't. Without it the seller
 *  lands on /home and has to find their own way back for the second post. */
function useSetupPostNudge(landedPostId: string | null) {
  const navigate = useNavigate();
  const { user } = useSession();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!landedPostId || !user || !inSetupPostGoal()) return;
    let cancelled = false;
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "published")
      .then(({ count: n, error }) => {
        if (!cancelled && !error && n != null) setCount(n);
      });
    return () => {
      cancelled = true;
    };
  }, [landedPostId, user]);

  if (count == null) return null;
  const done = count >= POSTS_NEEDED;
  const close = () => {
    setCount(null);
    if (done) endSetupPostGoal();
  };

  return (
    <div
      className={`oak-motion-fade fixed left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,360px)] rounded-3xl px-4 py-3.5 text-white ${GLASS_RIM}`}
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        ...glassDark,
        background: "rgba(24,26,30,0.86)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <Check size={16} className="mt-0.5 shrink-0 text-green-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">
            {done ? "Post content: done" : `Posted · ${count} of ${POSTS_NEEDED}`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-white/60">
            {done
              ? "Your store has its first posts."
              : `Post ${POSTS_NEEDED - count} more to finish this step.`}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Dismiss" className="shrink-0 p-0.5">
          <X size={15} className="text-white/60" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          close();
          navigate({ to: done ? "/store" : "/create" });
        }}
        className="mt-3 h-10 w-full rounded-full bg-white text-[14px] font-semibold text-black transition-transform active:scale-[0.97]"
      >
        {done ? "Back to setup" : "Post another"}
      </button>
    </div>
  );
}
