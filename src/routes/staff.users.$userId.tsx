import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { Card, ErrorNote, Field, OpenAsClient } from "@/components/staff/staff-ui";
import { staffApi, when } from "@/lib/staff-api";
import { nairaFromKobo } from "@/lib/order-format";

// One account: sign-in facts, profile, stores, orders placed and received.
export const Route = createFileRoute("/staff/users/$userId")({
  component: StaffUser,
});

type Order = {
  id: string;
  store_id: string;
  buyer_id: string | null;
  guest_email: string | null;
  status: string;
  total_kobo: number;
  delivery_method: string;
  courier_name: string | null;
  tracking_url: string | null;
  created_at: string;
};

type Detail = {
  account: {
    id: string;
    email: string | null;
    phone: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    is_anonymous: boolean;
    is_staff: boolean;
    providers: string[];
  };
  profile: {
    personal_username: string;
    display_name: string | null;
    personal_email: string;
    personal_phone: string | null;
    account_type: string | null;
    referral_source: string | null;
    created_at: string | null;
  } | null;
  stores: {
    id: string;
    brand_name: string;
    store_username: string;
    business_email: string | null;
    business_phone: string | null;
    store_type: string | null;
    theme_id: string | null;
    onboarded_at: string | null;
    created_at: string | null;
    pickup_address_line: string | null;
    pickup_city: string | null;
    pickup_state: string | null;
    pickup_country: string | null;
    shopify_shop_domain: string | null;
    bumpa_store_id: string | null;
    products: number;
    payout: { bank: string; holder: string | null; last4: string; status: string } | null;
  }[];
  orders_placed: Order[];
  orders_received: Order[];
  support_messages: number;
};

function StaffUser() {
  const { userId } = Route.useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    staffApi<Detail>(`/api/staff/users/${userId}`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [userId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton to={{ to: "/staff/users" }} alwaysShow className="text-neutral-900" />
        <h1 className="truncate text-xl font-semibold">
          {data?.profile?.display_name || data?.account.email || "Account"}
        </h1>
        {data && data.support_messages > 0 ? (
          <Link
            to="/staff/inbox/$userId"
            params={{ userId }}
            className="ml-auto shrink-0 text-sm text-neutral-600 underline"
          >
            Support thread ({data.support_messages})
          </Link>
        ) : null}
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!data && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      {data ? (
        <>
          <Card title="Account">
            <dl>
              <Field label="User id">{data.account.id}</Field>
              <Field label="Email">{data.account.email}</Field>
              <Field label="Phone">{data.account.phone}</Field>
              <Field label="Signed up">{when(data.account.created_at)}</Field>
              <Field label="Last sign-in">{when(data.account.last_sign_in_at)}</Field>
              <Field label="Email confirmed">{when(data.account.email_confirmed_at)}</Field>
              <Field label="Sign-in methods">{data.account.providers.join(", ") || "—"}</Field>
              <Field label="Type">
                {data.account.is_anonymous
                  ? "Anonymous buyer"
                  : data.account.is_staff
                    ? "Oakmonte staff"
                    : (data.profile?.account_type ?? "No profile yet")}
              </Field>
            </dl>
          </Card>

          {data.profile ? (
            <Card title="Profile">
              <dl>
                <Field label="Username">@{data.profile.personal_username}</Field>
                <Field label="Name">{data.profile.display_name}</Field>
                <Field label="Personal email">{data.profile.personal_email || "—"}</Field>
                <Field label="Personal phone">{data.profile.personal_phone}</Field>
                <Field label="Heard about us">{data.profile.referral_source}</Field>
              </dl>
            </Card>
          ) : null}

          {data.stores.map((s) => (
            <Card key={s.id} title={`Store: ${s.brand_name}`}>
              <dl>
                <Field label="Storefront">
                  <a
                    href={`/shop/${s.store_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    /shop/{s.store_username}
                  </a>
                </Field>
                <Field label="Store id">{s.id}</Field>
                <Field label="Type">{s.store_type}</Field>
                <Field label="Business email">{s.business_email}</Field>
                <Field label="Business phone">{s.business_phone}</Field>
                <Field label="Products">{String(s.products)}</Field>
                <Field label="Theme chosen">{s.theme_id ? "Yes" : "No"}</Field>
                <Field label="Setup finished">{when(s.onboarded_at)}</Field>
                <Field label="Pickup address">
                  {[s.pickup_address_line, s.pickup_city, s.pickup_state, s.pickup_country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Field>
                <Field label="Payout account">
                  {s.payout
                    ? `${s.payout.bank} ····${s.payout.last4}${s.payout.holder ? ` (${s.payout.holder})` : ""} · ${s.payout.status}`
                    : "Not set up"}
                </Field>
                <Field label="Connected">
                  {[
                    s.shopify_shop_domain ? `Shopify (${s.shopify_shop_domain})` : null,
                    s.bumpa_store_id ? "Bumpa" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Field>
                <Field label="Created">{when(s.created_at)}</Field>
              </dl>
            </Card>
          ))}

          {data.stores.length > 0 && !data.account.is_staff ? (
            <Card title="Work on this store">
              <p className="mb-3 text-sm text-neutral-600">
                Add products, pick the theme or finish setup in the client's own dashboard. Every
                link created is recorded against your name.
              </p>
              <OpenAsClient userId={data.account.id} />
            </Card>
          ) : null}

          <OrdersCard title="Orders received by their store" orders={data.orders_received} />
          <OrdersCard title="Orders they placed" orders={data.orders_placed} />
        </>
      ) : null}
    </div>
  );
}

function OrdersCard({ title, orders }: { title: string; orders: Order[] }) {
  return (
    <Card title={`${title} (${orders.length}${orders.length === 50 ? "+" : ""})`}>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">None.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-1 font-normal">Placed</th>
                <th className="px-4 py-1 font-normal">Order</th>
                <th className="px-4 py-1 font-normal">Status</th>
                <th className="px-4 py-1 font-normal">Total</th>
                <th className="px-4 py-1 font-normal">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap px-4 py-1.5">{when(o.created_at)}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-1.5">{o.status}</td>
                  <td className="px-4 py-1.5">{nairaFromKobo(o.total_kobo)}</td>
                  <td className="px-4 py-1.5">
                    {o.tracking_url ? (
                      <a
                        href={o.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {o.courier_name ?? o.delivery_method}
                      </a>
                    ) : (
                      (o.courier_name ?? o.delivery_method)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
