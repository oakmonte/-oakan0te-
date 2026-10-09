import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMySupabaseClient, supabase } from "@/lib/integrations/my-supabase/client";
import { setChatClient } from "@/lib/chat/db";
import { useSession } from "@/hooks/use-session";

/** Who a visitor is on a store's website, for chatting with the seller.
 *
 *  - Signed in with a real account, on someone else's store: themselves.
 *  - Signed out: an anonymous buyer (Supabase anonymous sign-in), kept in its
 *    own storage slot so it never touches the app's session.
 *  - The seller on their OWN website or preview: also that anonymous buyer,
 *    so they see exactly what a customer sees and their enquiries land in
 *    their own inbox as customer-xxxxxx -- without being signed out of the
 *    store they're running.
 *
 *  While a storefront is mounted, chat runs on whichever client that is
 *  (setChatClient); it reverts on unmount. */

const BUYER_STORAGE_KEY = "oakmonte-buyer-auth";

let buyerClient: SupabaseClient | null = null;
function getBuyerClient(): SupabaseClient {
  if (!buyerClient)
    buyerClient = createMySupabaseClient(BUYER_STORAGE_KEY) as unknown as SupabaseClient;
  return buyerClient;
}

export type StorefrontBuyer = {
  /** The buyer's user id; null until known (or if sign-in failed). */
  me: string | null;
  anonymous: boolean;
  ready: boolean;
  error: string | null;
};

const NOT_READY: StorefrontBuyer = { me: null, anonymous: false, ready: false, error: null };

export function useStorefrontBuyer(ownerId: string | null): StorefrontBuyer {
  const { user, loading } = useSession();
  const [buyer, setBuyer] = useState<StorefrontBuyer>(NOT_READY);

  const realBuyer = !!user && !user.is_anonymous && user.id !== ownerId;

  useEffect(() => {
    if (loading || !ownerId) return;
    let cancelled = false;

    if (realBuyer && user) {
      setChatClient(supabase as unknown as SupabaseClient);
      setBuyer({ me: user.id, anonymous: false, ready: true, error: null });
      return;
    }

    const client = getBuyerClient();
    setChatClient(client);
    void (async () => {
      const { data } = await client.auth.getSession();
      let session = data.session;
      if (!session) {
        const { data: signedIn, error } = await client.auth.signInAnonymously();
        if (error) {
          if (!cancelled) setBuyer({ ...NOT_READY, ready: true, error: error.message });
          return;
        }
        session = signedIn.session;
      }
      if (!cancelled) {
        setBuyer({ me: session?.user.id ?? null, anonymous: true, ready: true, error: null });
      }
    })();

    return () => {
      cancelled = true;
      setChatClient(null);
    };
  }, [loading, ownerId, realBuyer, user]);

  return buyer;
}

/** The storefront's buyer plus what lets a product page open the store's
 *  Messages tab after an enquiry is sent. */
export type StorefrontChat = StorefrontBuyer & {
  ownerId: string | null;
  storeName: string | null;
  openMessages: () => void;
};

export const StorefrontChatContext = createContext<StorefrontChat | null>(null);

export function useStorefrontChat(): StorefrontChat | null {
  return useContext(StorefrontChatContext);
}
