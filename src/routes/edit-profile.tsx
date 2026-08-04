import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

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

function slugifyUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
}

function EditProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">(
    "idle",
  );

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
        setAvatarUrl(profile.avatar_url);
        setDisplayName(profile.display_name || profile.personal_username);
        setUsername(profile.personal_username);
        setOriginalUsername(profile.personal_username);
        setBio(profile.bio || "");
      }
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!username || username === originalUsername) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("personal_username", username)
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username, originalUsername]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Couldn't upload photo. Try again.");
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  };

  // Safe navigation back to a profile — never routes to an empty username
  const goToProfile = (targetUsername: string) => {
    if (!targetUsername) {
      navigate({ to: "/" });
      return;
    }
    navigate({ to: "/profile/$username", params: { username: targetUsername } });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (usernameStatus === "taken") {
      setError("That username is taken. Try another.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || username,
        personal_username: username,
        avatar_url: avatarUrl,
        bio: bio.trim() || null,
      })
      .eq("id", userId);

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

    goToProfile(username);
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
        <button
          onClick={() => goToProfile(originalUsername)}
          aria-label="Back"
          className="absolute left-6"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold">Edit profile</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Profile picture — the only image field */}
        <div className="flex flex-col items-center gap-2 mt-2 mb-6">
          <img
            src={avatarUrl || "https://placehold.co/110x110"}
            alt="Profile"
            className="w-[90px] h-[90px] rounded-full object-cover border border-white/10"
          />
          <label className="text-[13px] font-medium text-white/70 cursor-pointer">
            Change photo
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>

        {/* Name + Username block */}
        <div className="mx-4 rounded-2xl bg-white/[0.06] divide-y divide-white/10 overflow-hidden">
          <FieldRow label="Name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={30}
              className="w-full bg-transparent text-right text-[14px] font-semibold placeholder:text-white/30 focus:outline-none"
            />
          </FieldRow>
          <FieldRow label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(slugifyUsername(e.target.value))}
              placeholder="username"
              maxLength={30}
              className="w-full bg-transparent text-right text-[14px] font-semibold placeholder:text-white/30 focus:outline-none"
            />
          </FieldRow>
          {username !== originalUsername && username.length > 0 && (
            <div className="px-4 py-2 text-[11px]">
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
              maxLength={160}
              rows={3}
              className="w-full bg-transparent text-[14px] placeholder:text-white/30 focus:outline-none resize-none"
            />
          </div>
        </div>

        {error && <p className="text-[12px] text-red-400 text-center mt-4">{error}</p>}

        <div className="px-4 mt-8 pb-10">
          <button
            type="submit"
            disabled={saving || usernameStatus === "taken" || usernameStatus === "checking"}
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
