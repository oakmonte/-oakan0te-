import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, ChevronRight } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useBack } from "@/hooks/use-back";
import { setOwnUsername } from "@/hooks/use-own-username";
import { currentIndex, findAncestor, readIndex } from "@/lib/nav-stack";
import { USERNAME_MAX, normalizeUsername, validateUsername } from "@/lib/username-rules";

export const Route = createFileRoute("/edit-profile")({
  head: () => ({ meta: [{ title: "Edit profile — Oakmonte" }] }),
  component: EditProfilePage,
});

type ProfileRow = {
  id: string;
  personal_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

const NAME_MAX = 30;
const BIO_MAX = 160;
// Phones hand over 12MP HEIC/JPEG straight from the camera roll; anything much
// past this is a mistake (a screenshot of a PDF, a RAW), not a profile photo.
const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

function EditProfilePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { back } = useBack();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  // What was loaded, so Save only lights up when something actually changed.
  const original = useRef({ displayName: "", bio: "", avatarUrl: null as string | null });

  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const usernameProblem =
    username && username !== originalUsername ? validateUsername(username) : null;

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/" });
        return;
      }
      setUserId(user.id);

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, personal_username, display_name, avatar_url, bio")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        console.error("edit-profile: failed to fetch profile", fetchError);
        setError("Couldn't load your profile. Please try again.");
      } else if (data) {
        const profile = data as ProfileRow;
        const name = profile.display_name || profile.personal_username;
        setAvatarUrl(profile.avatar_url);
        setDisplayName(name);
        setUsername(profile.personal_username);
        setOriginalUsername(profile.personal_username);
        setBio(profile.bio || "");
        original.current = {
          displayName: name,
          bio: profile.bio || "",
          avatarUrl: profile.avatar_url,
        };
      }
      setLoading(false);
    })();
  }, [navigate]);

  // Through the is_username_available RPC, not a select on profiles:
  // profiles' SELECT policy is auth.uid() = id, so a direct lookup of someone
  // else's username always came back empty and every name read as
  // "available" — the taken error only surfaced on Save.
  useEffect(() => {
    if (!username || username === originalUsername || usernameProblem) {
      setUsernameStatus("idle");
      return;
    }
    let cancelled = false;
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("is_username_available", {
        check_username: username,
      });
      if (cancelled) return;
      if (rpcError) {
        console.error("edit-profile: username check failed", rpcError);
        setUsernameStatus("error");
        return;
      }
      setUsernameStatus(data ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, originalUsername, usernameProblem]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again after an error still fires change.
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't a photo.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("That photo is over 10MB. Pick a smaller one.");
      return;
    }

    setError(null);
    setUploading(true);
    // Show the pick straight away; the upload catches up behind it.
    const preview = URL.createObjectURL(file);
    const previous = avatarUrl;
    setAvatarUrl(preview);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    setUploading(false);
    URL.revokeObjectURL(preview);

    if (uploadError) {
      console.error("edit-profile: avatar upload failed", uploadError);
      setAvatarUrl(previous);
      setError("Couldn't upload photo. Try again.");
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // The storage path is deterministic (same user, same extension) and
    // upsert overwrites it in place, so getPublicUrl returns the exact same
    // URL as before the upload — the browser (and any CDN in front of
    // storage) just keeps showing the cached old image at that URL. A
    // cache-busting query param forces every consumer to actually refetch.
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
  };

  // After a save, leave the way back would — pop, don't push. It used to
  // navigate() forward to the profile, so the stack grew profile → edit →
  // profile and back from the "updated" profile returned to the form.
  //
  // A new username is the awkward case: the profile behind us lives at the
  // OLD /profile/$username, which no longer resolves. Pop to it and replace
  // it with the new URL in the same move, the way useGoRoot unwinds.
  const leaveAfterSave = (oldName: string, newName: string) => {
    if (oldName === newName) {
      back();
      return;
    }
    const land = () =>
      void navigate({ to: "/profile/$username", params: { username: newName }, replace: true });
    const depth = findAncestor(`/profile/${oldName}`);
    if (depth < 0) {
      land();
      return;
    }
    const target = depth;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(timer);
      land();
    };
    const unsubscribe = router.history.subscribe(() => {
      if (readIndex(router.history.location.state) === target) finish();
    });
    const timer = setTimeout(finish, 300);
    router.history.go(depth - currentIndex());
  };

  const dirty =
    displayName.trim() !== original.current.displayName ||
    bio.trim() !== original.current.bio ||
    avatarUrl !== original.current.avatarUrl ||
    username !== originalUsername;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || uploading) return;
    if (usernameProblem) {
      setError(usernameProblem);
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is taken. Try another.");
      return;
    }

    setSaving(true);
    setError(null);

    // .select() so a write that matched no row comes back as an empty array
    // instead of a silent success. With RLS on profiles an update that the
    // policy filters out is NOT an error — it just touches nothing, and the
    // page used to report "saved" for it.
    const { data: saved, error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || username,
        personal_username: username,
        avatar_url: avatarUrl,
        bio: bio.trim() || null,
      })
      .eq("id", userId)
      .select("id");

    setSaving(false);

    if (updateError) {
      if (updateError.code === "23505") {
        setError("That username is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error("edit-profile: failed to save", updateError);
      }
      return;
    }
    if (!saved || saved.length === 0) {
      setError("Your changes weren't saved. Sign in again and retry.");
      console.error("edit-profile: update matched no row", { userId });
      return;
    }

    // The profile page reads through a 30s-stale query cache. Without this it
    // showed the OLD name, bio and photo after a save — which is what made the
    // page look like it didn't edit anything.
    await queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    if (username !== originalUsername) setOwnUsername(username);

    leaveAfterSave(originalUsername, username);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <span className="text-white/50 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-center relative px-6 pt-4 pb-4">
        {/* Reachable from Settings AND straight from the profile header, so
            the right parent is whichever is actually behind us — useBack
            resolves that from the stack rather than guessing. */}
        <BackButton className="absolute left-6" />
        <h1 className="text-[16px] font-bold">Edit profile</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Profile picture — the only image field. The whole label (photo
            included, not just the "Change photo" text) opens the picker. */}
        <label className="flex flex-col items-center gap-2 mt-2 mb-6 cursor-pointer">
          <span className="relative">
            <img
              src={avatarUrl || "https://placehold.co/110x110"}
              alt="Profile"
              className={`w-[90px] h-[90px] rounded-full object-cover border border-white/10 transition-opacity ${
                uploading ? "opacity-50" : ""
              }`}
            />
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
              <Camera size={14} />
            </span>
          </span>
          <span className="text-[13px] font-medium text-white/70">
            {uploading ? "Uploading…" : "Change photo"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleAvatarChange}
          />
        </label>

        {/* Name + Username block */}
        <div className="mx-4 rounded-2xl bg-white/[0.06] divide-y divide-white/10 overflow-hidden">
          <FieldRow label="Name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={NAME_MAX}
              className="w-full bg-transparent text-right text-[14px] font-semibold placeholder:text-white/30 focus:outline-none"
            />
          </FieldRow>
          <FieldRow label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              placeholder="username"
              maxLength={USERNAME_MAX}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent text-right text-[14px] font-semibold placeholder:text-white/30 focus:outline-none"
            />
          </FieldRow>
          {username !== originalUsername && username.length > 0 && (
            <div className="px-4 py-2 text-[11px]">
              {usernameProblem && <span className="text-red-400">{usernameProblem}</span>}
              {usernameStatus === "error" && (
                <span className="text-white/40">Couldn't check right now — Save will confirm</span>
              )}
              {usernameStatus === "checking" && (
                <span className="text-white/40">Checking availability…</span>
              )}
              {usernameStatus === "available" && (
                <span className="text-green-400">@{username} is available</span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-red-400">That username is taken</span>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="mx-4 mt-6">
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Basic info</div>
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short description about who you are or what your account is about"
              maxLength={BIO_MAX}
              rows={3}
              className="w-full bg-transparent text-[14px] placeholder:text-white/30 focus:outline-none resize-none"
            />
            <div className="text-right text-[11px] text-white/30">
              {bio.length}/{BIO_MAX}
            </div>
          </div>
        </div>

        {error && <p className="text-[12px] text-red-400 text-center mt-4">{error}</p>}

        <div className="px-4 mt-8 pb-10">
          <button
            type="submit"
            disabled={
              !dirty ||
              saving ||
              uploading ||
              !!usernameProblem ||
              usernameStatus === "taken" ||
              usernameStatus === "checking"
            }
            className="w-full rounded-full bg-white text-black py-3.5 text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-[14px] text-white/50">{label}</span>
      <div className="flex items-center gap-1.5 max-w-[65%]">
        {children}
        <ChevronRight size={14} className="text-white/20 shrink-0" />
      </div>
    </div>
  );
}
