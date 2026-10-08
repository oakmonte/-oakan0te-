import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  followStatusQueryOptions,
  profileQueryOptions,
  profileStatsQueryOptions,
} from "@/lib/queries/profile";
import { PaperPlaneTilt, UserCheck, UserPlus } from "@/components/icons/phosphor";
import { PostsGrid } from "@/components/profile/PostsGrid";

/** Explore's Profile tab: the visitor view of whoever posted the card you just
 *  swiped away from: who they are, Follow and Message, then their posts. Reads
 *  through the same cached queries as the full profile page, so a follow made
 *  here is the follow the profile page shows. */
export function AuthorProfilePage({ username }: { username: string | null }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: profile, isPending } = useQuery({
    ...profileQueryOptions(username ?? ""),
    enabled: !!username,
  });
  const { data: stats } = useQuery(profileStatsQueryOptions(profile?.id));
  const { data: isFollowing = false } = useQuery(followStatusQueryOptions(user?.id, profile?.id));
  const isOwn = !!user && !!profile && user.id === profile.id;

  async function toggleFollow() {
    if (!profile || busy) return;
    if (!user) {
      void navigate({ to: "/sign-in" });
      return;
    }
    const was = isFollowing;
    const followKey = followStatusQueryOptions(user.id, profile.id).queryKey;
    const statsKey = profileStatsQueryOptions(profile.id).queryKey;
    const shift = (by: number) =>
      queryClient.setQueryData(statsKey, (old) =>
        old ? { ...old, followers_count: Math.max(0, old.followers_count + by) } : old,
      );
    setBusy(true);
    queryClient.setQueryData(followKey, !was);
    shift(was ? -1 : 1);
    const { error } = was
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
      : await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    if (error) {
      console.error("AuthorProfilePage: failed to toggle follow", error);
      queryClient.setQueryData(followKey, was);
      shift(was ? 1 : -1);
    }
    setBusy(false);
  }

  if (!username) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-[14px] text-white/50">
        Swipe through a post first, and its creator shows up here.
      </div>
    );
  }
  if (isPending) return <div className="h-full w-full" />;
  if (!profile) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[14px] text-white/50">
        This profile isn&apos;t available.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto pb-28">
      <div className="flex flex-col items-center px-6 pt-6 text-center">
        <Link
          to="/profile/$username"
          params={{ username: profile.personal_username }}
          className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-white bg-white/5"
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={36} className="text-white/40" />
          )}
        </Link>
        <p className="mt-3 text-[17px] font-bold">
          {profile.display_name || profile.personal_username}
        </p>
        <p className="text-[13px] text-white/50">@{profile.personal_username}</p>
        <div className="mt-3 flex gap-6 text-center">
          <div>
            <p className="text-[16px] font-bold">{stats?.following_count ?? 0}</p>
            <p className="text-[12px] text-white/50">Following</p>
          </div>
          <div>
            <p className="text-[16px] font-bold">{stats?.followers_count ?? 0}</p>
            <p className="text-[12px] text-white/50">Followers</p>
          </div>
        </div>
        {profile.bio && <p className="mt-3 text-[14px] text-white/80">{profile.bio}</p>}

        {!isOwn && (
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void toggleFollow()}
              disabled={busy}
              className={`flex h-11 min-w-[130px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold active:scale-95 disabled:opacity-60 ${
                isFollowing ? "bg-white/10 text-white" : "bg-white text-black"
              }`}
            >
              {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              onClick={() =>
                user
                  ? void navigate({ to: "/messages", search: { to: profile.personal_username } })
                  : void navigate({ to: "/sign-in" })
              }
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-5 text-[15px] font-semibold text-white active:scale-95"
            >
              <PaperPlaneTilt size={18} />
              Message
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <PostsGrid
          userId={profile.id}
          status="published"
          emptyState={<p className="pt-10 text-center text-[14px] text-white/50">No posts yet</p>}
        />
      </div>
    </div>
  );
}
