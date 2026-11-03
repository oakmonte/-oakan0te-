import { createFileRoute, Link } from "@tanstack/react-router";
import { B, LegalPage, List, Mail, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_UPDATED } from "@/components/legal/legal-facts";

const DESCRIPTION =
  "How to delete your Oakmonte account and data, including anything imported from Instagram.";

// Public, signed-out page: Meta's app settings link here as the "User data
// deletion instructions URL", and its checker has to be able to load it.
// Keep it in step with the retention section of the Privacy Policy and with
// what /api/account/delete actually removes.
export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Delete Your Data — Oakmonte" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Delete Your Data — Oakmonte" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataDeletionPage,
});

const SECTIONS: LegalSection[] = [
  {
    id: "in-the-app",
    title: "Delete Your Account in the App",
    body: (
      <>
        <List>
          <li>Sign in to Oakmonte.</li>
          <li>
            Open <B>Settings</B> and tap <B>Delete account</B>.
          </li>
          <li>
            Type <B>DELETE</B> (and your password, if you have one) and confirm.
          </li>
        </List>
        <p>
          This permanently deletes your profile, your store, its products and posts, and any
          Instagram or Shopify connection, including the access token we held for it. It can&apos;t
          be undone.
        </p>
      </>
    ),
  },
  {
    id: "instagram",
    title: "Remove Oakmonte from Instagram",
    body: (
      <>
        <p>
          If you connected Instagram to import products, you can also cut Oakmonte off from your
          Instagram account at any time:
        </p>
        <List>
          <li>
            In Instagram, go to <B>Settings and privacy</B> → <B>Website permissions</B> →{" "}
            <B>Apps and websites</B>.
          </li>
          <li>
            Find <B>Oakmonte</B> and tap <B>Remove</B>.
          </li>
        </List>
        <p>
          After that, Oakmonte can no longer read anything from your Instagram account. To also
          delete the products and media we already imported, delete them from your store or ask us
          to, as below.
        </p>
      </>
    ),
  },
  {
    id: "by-email",
    title: "Ask Us to Delete It",
    body: (
      <>
        <p>
          Can&apos;t sign in, or want only some of your data deleted? Email <Mail /> from the email
          address on your account, with the subject <B>Delete my data</B>. Tell us your store name
          or username and what you want deleted.
        </p>
        <p>
          We may ask you to confirm the request is yours. We will act on it within 30 days and email
          you when it&apos;s done.
        </p>
      </>
    ),
  },
  {
    id: "what-we-keep",
    title: "What We Have to Keep",
    body: (
      <>
        <p>We delete or anonymise your personal data within 30 days, except:</p>
        <List>
          <li>
            records of orders, payments and payouts, which Nigerian tax and accounting rules require
            us to keep for 6 years;
          </li>
          <li>data needed for an ongoing dispute, investigation or legal claim, until it ends;</li>
          <li>copies in backups, which are overwritten within 90 days.</li>
        </List>
        <p>
          More detail is in our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
];

function DataDeletionPage() {
  return (
    <LegalPage
      title="Delete Your Data"
      updated={LEGAL_UPDATED}
      summary={
        <p>
          You can delete your Oakmonte account and everything in it from Settings, remove
          Oakmonte&apos;s access from Instagram, or email us and we&apos;ll do it for you.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
