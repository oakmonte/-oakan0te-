import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

/** The signed-in account's role ("seller" | "creator" | "curator"), as chosen in
 *  onboarding. It lives on profiles, which only the owner can read, and is not
 *  part of the public profile view -- so a page that wants to act on the role
 *  asks for it here. `undefined` while loading, `null` when there is none. */
export function useOwnAccountType(): string | null | undefined {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["own-account-type", user?.id] as const,
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) {
        console.error("useOwnAccountType: failed to load", error);
        return null;
      }
      return row?.account_type ?? null;
    },
  });
  return data;
}
