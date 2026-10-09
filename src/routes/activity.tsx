import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  ChevronRight,
  CircleX,
  MessageCircle,
  Package,
  PackageCheck,
  RotateCw,
  ShoppingBag,
  Truck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Avatar } from "@/components/messages/Avatar";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { relativeShort } from "@/lib/messages-format";
import { followStatusQueryOptions, profileStatsQueryOptions } from "@/lib/queries/profile";
import {
  ACTIVITY_FILTERS,
  ActivityLoadError,
  SOURCE_LABEL,
  activityQueryOptions,
  filterActivity,
  filterOf,
  groupActivity,
  isUnseen,
  markActivitySeen,
  readLastSeen,
  seenWatermark,
  sourcesForFilter,
  type ActivityFeed,
  type ActivityFilter,
  type ActivityItem,
  type ActivityPerson,
  type BuyerOrderStatus,
} from "@/lib/activity";

// Spelled out rather than derived from ACTIVITY_FILTERS: validateSearch stays
// in the main bundle (only the component is code-split), so importing the
// activity lib for it would drag the whole lib into every page's first load.
const FILTER_KEYS: ReadonlySet<string> = new Set(["orders", "followers", "messages"]);

export const Route = createFileRoute("/activity")({
  // ?filter=orders etc., so a bell or a push can open straight onto one tab.
  validateSearch: (search: Record<string, unknown>): { filter?: Exclude<ActivityFilter, "all"> } =>
    typeof search.filter === "string" && search.filter !== "all" && FILTER_KEYS.has(search.filter)
      ? { filter: search.filter as Exclude<ActivityFilter, "all"> }
      : {},
  head: () => ({ meta: [{ title: "Activity — Oakmonte" }] }),
  component: ActivityPage,
});

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

function ActivityPage() {
  const { user, loading } = useSession();

  return (
    <div className="min-h-screen bg-chat-bg pb-[calc(env(safe-area-inset-bottom)+2rem)] text-chat-text">
      <div className="mx-auto w-full max-w-[560px] md:border-x md:border-chat-border">
        {loading ? (
          <>
            <Header />
            <FeedSkeleton />
          </>
        ) : !user ? (
          <>
            <Header />
            <SignedOut />
          </>
        ) : (
          // Keyed by account: the "seen before" snapshot below belongs to one
          // person, and must be re-read if someone else signs in.
          <ActivityFeedView key={user.id} userId={user.id} />
        )}
      </div>
    </div>
  );
}

function Header({ children, refresh }: { children?: ReactNode; refresh?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-chat-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-[56px] items-center gap-1 px-2">
        <BackButton
          icon="chevron"
          size={28}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-chat-text/10"
        />
        <h1 className="flex-1 pl-1 text-[22px] font-bold tracking-[-0.02em]">Activity</h1>
        {refresh}
      </div>
      {children}
    </header>
  );
}

function ActivityFeedView({ userId }: { userId: string }) {
  const { filter: searchFilter } = Route.useSearch();
  const filter: ActivityFilter = searchFilter ?? "all";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery(activityQueryOptions(userId));

  // What counted as seen when the screen opened. Frozen for the visit, so
  // what was new stays marked while it's being read -- the stored watermark
  // moves on underneath (below) and the bell clears straight away.
  const [seenBefore] = useState(() => readLastSeen(userId));

  useEffect(() => {
    // Only after a successful load: marking on a failed one would swallow
    // items the viewer never actually saw.
    if (!query.data) return;
    markActivitySeen(userId, seenWatermark(query.data.items, Date.now()));
  }, [userId, query.data]);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(noticeTimer.current ?? undefined), []);
  const flash = (message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current ?? undefined);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const [followBusy, setFollowBusy] = useState<ReadonlySet<string>>(new Set());
  const feedKey = activityQueryOptions(userId).queryKey;

  function setFollowingBack(personId: string, value: boolean) {
    queryClient.setQueryData<ActivityFeed>(feedKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((item) =>
              item.kind === "follow" && item.person.id === personId
                ? { ...item, followingBack: value }
                : item,
            ),
          }
        : old,
    );
  }

  async function toggleFollow(person: ActivityPerson, next: boolean) {
    if (followBusy.has(person.id)) return;
    setFollowBusy((prev) => new Set(prev).add(person.id));
    // Optimistic, like the profile page's button: it flips on the tap.
    setFollowingBack(person.id, next);
    // Same direct write the profile page and the feed make: follows' own RLS
    // only lets a signed-in user insert or delete rows where they are the
    // follower, so this needs no server route.
    const { error } = next
      ? await supabase.from("follows").insert({ follower_id: userId, following_id: person.id })
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", person.id);
    // 23505: already following (from another screen since this loaded). The
    // goal state holds, so it isn't a failure.
    if (error && !(next && error.code === "23505")) {
      console.error("activity: follow toggle failed", error);
      setFollowingBack(person.id, !next);
      flash(next ? `Couldn't follow ${person.name}` : `Couldn't unfollow ${person.name}`);
    } else {
      // Keep the profile page's cached button and counts honest.
      queryClient.setQueryData(followStatusQueryOptions(userId, person.id).queryKey, next);
      void queryClient.invalidateQueries({
        queryKey: profileStatsQueryOptions(person.id).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: profileStatsQueryOptions(userId).queryKey });
    }
    setFollowBusy((prev) => {
      const out = new Set(prev);
      out.delete(person.id);
      return out;
    });
  }

  const data = query.data;
  const items = useMemo(() => (data ? filterActivity(data.items, filter) : []), [data, filter]);
  // Not memoised: at most FEED_LIMIT items, and reading the clock on each
  // render is what re-buckets "Today" after midnight.
  const groups = groupActivity(items, seenBefore, Date.now());

  // New-since-last-visit per tab. Not on a first visit, where every item is
  // technically new and the numbers would only be noise.
  const newCounts = useMemo(() => {
    const counts: Partial<Record<ActivityFilter, number>> = {};
    if (!data || seenBefore === null) return counts;
    for (const item of data.items) {
      if (!isUnseen(item, seenBefore)) continue;
      const key = filterOf(item);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [data, seenBefore]);

  const pickFilter = (key: ActivityFilter) =>
    void navigate({
      to: "/activity",
      search: key === "all" ? {} : { filter: key },
      replace: true,
    });

  const refreshing = query.isFetching && !!data;
  // Only the failures this tab is made of. With one of them missing, an
  // empty tab isn't "nothing happened" -- it's "we couldn't check".
  const gaps = data
    ? data.unavailable.filter((source) => sourcesForFilter(filter).includes(source))
    : [];

  return (
    <>
      <Header
        refresh={
          data ? (
            <button
              type="button"
              aria-label="Refresh"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chat-muted active:bg-chat-text/10 disabled:opacity-60"
            >
              <RotateCw size={20} className={refreshing ? "animate-spin" : undefined} />
            </button>
          ) : null
        }
      >
        <div
          role="tablist"
          aria-label="Filter activity"
          className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1 no-scrollbar"
        >
          {ACTIVITY_FILTERS.map(({ key, label }) => {
            const selected = filter === key;
            const count = key === "all" ? 0 : (newCounts[key] ?? 0);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => pickFilter(key)}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-[18px] text-[15px] font-semibold transition-colors ${
                  selected ? "bg-chat-text text-chat-inverse" : "bg-chat-soft text-chat-text"
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    aria-label={`${count} new`}
                    className={`rounded-full px-1.5 text-[11.5px] ${
                      selected ? "bg-chat-inverse/20" : "bg-chat-accent text-white"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Header>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="mx-4 mt-2 rounded-[14px] bg-chat-elevated px-4 py-3 text-[14px] text-chat-text">
            {notice}
          </div>
        )}
      </div>

      {query.isPending ? (
        <FeedSkeleton />
      ) : query.isError ? (
        <LoadError
          signedOut={query.error instanceof ActivityLoadError && query.error.status === 401}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {gaps.length > 0 && (
            <PartialNotice
              sources={gaps.map((source) => SOURCE_LABEL[source])}
              retrying={query.isFetching}
              onRetry={() => void query.refetch()}
            />
          )}

          {groups.length === 0
            ? gaps.length === 0 && <EmptyState filter={filter} isSeller={!!data?.isSeller} />
            : groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="px-4 pb-1 pt-5 text-[15px] font-bold">{group.label}</h2>
                  <ul>
                    {group.items.map((item) => (
                      <ActivityRow
                        key={item.key}
                        item={item}
                        highlight={seenBefore !== null && isUnseen(item, seenBefore)}
                        followBusy={item.kind === "follow" && followBusy.has(item.person.id)}
                        onToggleFollow={toggleFollow}
                      />
                    ))}
                  </ul>
                </section>
              ))}

          {filter === "all" && (
            // Honest about the gap: the feed has a like button, so someone
            // will wonder why their likes never show up here.
            <p className="px-8 pb-4 pt-8 text-center text-[12.5px] leading-relaxed text-chat-faint">
              Likes, comments and mentions will show up here once they go live.
            </p>
          )}
        </>
      )}
    </>
  );
}

/* ---------- rows ---------- */

type RowProps = {
  item: ActivityItem;
  highlight: boolean;
  followBusy: boolean;
  onToggleFollow: (person: ActivityPerson, next: boolean) => void;
};

function ActivityRow({ item, highlight, followBusy, onToggleFollow }: RowProps) {
  const time = relativeShort(item.at);
  return (
    <li
      className={`relative flex items-center gap-3 px-4 py-2 transition-colors ${
        highlight ? "bg-chat-accent/[0.07]" : ""
      }`}
    >
      {highlight && (
        <span
          aria-hidden
          className="absolute left-1.5 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-chat-accent"
        />
      )}
      {highlight && <span className="sr-only">New: </span>}
      {item.kind === "follow" ? (
        <FollowRow
          item={item}
          time={time}
          busy={followBusy}
          onToggle={(next) => onToggleFollow(item.person, next)}
        />
      ) : item.kind === "messages" ? (
        <MessagesRow item={item} time={time} />
      ) : item.kind === "store-order" ? (
        <StoreOrderRow item={item} time={time} />
      ) : (
        <MyOrderRow item={item} time={time} />
      )}
    </li>
  );
}

// 52px tall at minimum: comfortably over the 40px tap target, and the rows
// line up whether or not they wrap to a second line.
const ROW_BOX = "flex min-h-[52px] min-w-0 flex-1 items-center gap-3";
const ROW_LINK = `${ROW_BOX} active:opacity-60`;

function Stamp({ time }: { time: string }) {
  return <span className="whitespace-nowrap text-chat-muted"> {time}</span>;
}

function FollowRow({
  item,
  time,
  busy,
  onToggle,
}: {
  item: Extract<ActivityItem, { kind: "follow" }>;
  time: string;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { person } = item;
  const body = (
    <>
      <Avatar kind="direct" name={person.name} src={person.avatarUrl} seed={person.id} size={44} />
      <p className="min-w-0 flex-1 text-[14.5px] leading-snug">
        <span className="font-semibold">{person.name}</span> started following you.
        <Stamp time={time} />
      </p>
    </>
  );
  return (
    <>
      {person.username ? (
        <Link to="/profile/$username" params={{ username: person.username }} className={ROW_LINK}>
          {body}
        </Link>
      ) : (
        <div className={ROW_BOX}>{body}</div>
      )}
      <button
        type="button"
        onClick={() => onToggle(!item.followingBack)}
        disabled={busy}
        aria-label={item.followingBack ? `Unfollow ${person.name}` : `Follow ${person.name} back`}
        className={`flex h-10 shrink-0 items-center justify-center rounded-[10px] px-4 text-[14px] font-semibold transition-colors active:scale-[0.97] disabled:opacity-60 ${
          item.followingBack ? "bg-chat-soft text-chat-text" : "bg-chat-text text-chat-inverse"
        }`}
      >
        {item.followingBack ? "Following" : "Follow back"}
      </button>
    </>
  );
}

function MessagesRow({
  item,
  time,
}: {
  item: Extract<ActivityItem, { kind: "messages" }>;
  time: string;
}) {
  const { person, unreadCount } = item;
  return (
    <Link
      to="/messages"
      // ?to= is the profile "Message" deep link: it opens this person's chat
      // directly. Without a username there's nothing to address, so the
      // inbox itself is the best we can do.
      search={person.username ? { to: person.username } : {}}
      className={ROW_LINK}
    >
      <Avatar kind="direct" name={person.name} src={person.avatarUrl} seed={person.id} size={44} />
      <p className="min-w-0 flex-1 text-[14.5px] leading-snug">
        <span className="font-semibold">{person.name}</span>{" "}
        {unreadCount === 1 ? "sent you a message." : `sent you ${unreadCount} messages.`}
        <Stamp time={time} />
      </p>
      <span
        aria-hidden
        className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-chat-accent px-1.5 text-[12px] font-semibold text-white"
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    </Link>
  );
}

function linesLabel(title: string, lineCount: number) {
  return lineCount > 1 ? `${title} + ${lineCount - 1} more` : title;
}

function OrderThumb({ src, badge }: { src: string | null; badge: ReactNode }) {
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-chat-soft text-chat-muted">
        {src ? (
          <img
            src={src}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package size={20} />
        )}
      </div>
      <span className="absolute -bottom-1 -right-1 flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-chat-bg bg-chat-text text-chat-inverse">
        {badge}
      </span>
    </div>
  );
}

function StoreOrderRow({
  item,
  time,
}: {
  item: Extract<ActivityItem, { kind: "store-order" }>;
  time: string;
}) {
  const paid = item.event === "paid";
  return (
    <Link to="/store/orders" className={ROW_LINK}>
      <OrderThumb
        src={item.imageUrl}
        badge={
          paid ? (
            <ShoppingBag size={10} strokeWidth={2.6} />
          ) : (
            <PackageCheck size={10} strokeWidth={2.6} />
          )
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug">
          {paid ? (
            <>
              <span className="font-semibold">New order</span>
              {item.buyerName ? ` from ${item.buyerName}` : ""} · {naira(item.totalKobo)}
            </>
          ) : (
            <>
              <span className="font-semibold">Delivered</span>
              {item.buyerName ? ` to ${item.buyerName}` : ""}
            </>
          )}
          <Stamp time={time} />
        </p>
        <p className="mt-0.5 truncate text-[13px] text-chat-muted">
          {paid && item.toShip ? "Ready to ship · " : ""}
          {linesLabel(item.title, item.lineCount)}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-chat-faint" />
    </Link>
  );
}

const BUYER_COPY: Record<
  BuyerOrderStatus,
  { text: (store: string) => ReactNode; icon: ReactNode }
> = {
  paid: {
    text: (store) => (
      <>
        Payment confirmed for your order from <span className="font-semibold">{store}</span>.
      </>
    ),
    icon: <Wallet size={10} strokeWidth={2.6} />,
  },
  shipped: {
    text: (store) => (
      <>
        Your order from <span className="font-semibold">{store}</span> is on its way.
      </>
    ),
    icon: <Truck size={10} strokeWidth={2.6} />,
  },
  delivered: {
    text: (store) => (
      <>
        Your order from <span className="font-semibold">{store}</span> was delivered.
      </>
    ),
    icon: <PackageCheck size={10} strokeWidth={2.6} />,
  },
  declined: {
    text: (store) => (
      <>
        Your order from <span className="font-semibold">{store}</span> was declined.
      </>
    ),
    icon: <CircleX size={10} strokeWidth={2.6} />,
  },
  cancelled: {
    text: (store) => (
      <>
        Your order from <span className="font-semibold">{store}</span> was cancelled.
      </>
    ),
    icon: <CircleX size={10} strokeWidth={2.6} />,
  },
};

function MyOrderRow({
  item,
  time,
}: {
  item: Extract<ActivityItem, { kind: "my-order" }>;
  time: string;
}) {
  const copy = BUYER_COPY[item.status];
  return (
    <Link to="/order/$orderId" params={{ orderId: item.orderId }} className={ROW_LINK}>
      <OrderThumb src={item.imageUrl} badge={copy.icon} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug">
          {copy.text(item.storeName ?? "the seller")}
          <Stamp time={time} />
        </p>
        <p className="mt-0.5 truncate text-[13px] text-chat-muted">
          {linesLabel(item.title, item.lineCount)} · {naira(item.totalKobo)}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-chat-faint" />
    </Link>
  );
}

/* ---------- states ---------- */

function FeedSkeleton() {
  return (
    <div aria-hidden className="pt-5">
      <div className="mx-4 mb-3 h-4 w-20 rounded-full bg-chat-soft" />
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-2.5">
          <div className="h-11 w-11 shrink-0 rounded-full bg-chat-soft" />
          <div className="flex-1 space-y-2">
            <div
              className="h-3 rounded-full bg-chat-soft"
              style={{ width: `${82 - index * 6}%` }}
            />
            <div className="h-3 w-1/3 rounded-full bg-chat-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateBlock({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-10 pt-20 text-center">
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-chat-border bg-chat-soft text-chat-text">
        {icon}
      </div>
      <p className="mt-5 text-[18px] font-bold">{title}</p>
      <p className="mt-1.5 max-w-[300px] text-[14.5px] leading-snug text-chat-muted">{body}</p>
      {children}
    </div>
  );
}

function SignedOut() {
  return (
    <StateBlock
      icon={<Bell size={28} />}
      title="Your activity lives here"
      body="Sign in to see new followers, updates on your orders and messages waiting for you."
    >
      <Link
        to="/sign-in"
        className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
      >
        Sign in
      </Link>
    </StateBlock>
  );
}

function LoadError({
  signedOut,
  retrying,
  onRetry,
}: {
  signedOut: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  // A 401 with a session in hand means the token expired mid-visit; signing
  // in again is the fix, retrying isn't.
  if (signedOut) return <SignedOut />;
  return (
    <StateBlock
      icon={<AlertCircle size={28} />}
      title="Couldn't load your activity"
      body="Check your connection and try again."
    >
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-6 flex h-11 items-center rounded-full bg-chat-soft px-6 text-[15px] font-semibold active:scale-95 disabled:opacity-60"
      >
        {retrying ? "Trying again…" : "Try again"}
      </button>
    </StateBlock>
  );
}

function PartialNotice({
  sources,
  retrying,
  onRetry,
}: {
  sources: string[];
  retrying: boolean;
  onRetry: () => void;
}) {
  const list =
    sources.length === 1
      ? sources[0]
      : `${sources.slice(0, -1).join(", ")} and ${sources[sources.length - 1]}`;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-[16px] bg-chat-elevated py-2 pl-4 pr-2">
      <AlertCircle size={18} className="shrink-0 text-chat-muted" />
      <p className="flex-1 text-[13.5px] leading-snug text-chat-muted">
        Couldn't load {list} just now.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="h-10 shrink-0 rounded-full px-3 text-[14px] font-semibold text-chat-text active:bg-chat-text/10 disabled:opacity-60"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ filter, isSeller }: { filter: ActivityFilter; isSeller: boolean }) {
  switch (filter) {
    case "orders":
      return (
        <StateBlock
          icon={<ShoppingBag size={28} />}
          title="No order updates"
          body={
            isSeller
              ? "New orders to your store, deliveries and updates on things you've bought will show up here."
              : "When you buy something, every step from payment to delivery will show up here."
          }
        />
      );
    case "followers":
      return (
        <StateBlock
          icon={<UserPlus size={28} />}
          title="No followers yet"
          body="When someone follows you, you'll see it here and can follow them back."
        />
      );
    case "messages":
      return (
        <StateBlock
          icon={<MessageCircle size={28} />}
          title="You're all caught up"
          body="Chats with messages you haven't read will show up here."
        />
      );
    default:
      return (
        <StateBlock
          icon={<Bell size={28} />}
          title="No activity yet"
          body={
            isSeller
              ? "New followers, orders to your store and unread messages will show up here."
              : "New followers, updates on your orders and unread messages will show up here."
          }
        />
      );
  }
}
