import { createFileRoute, Link } from "@tanstack/react-router";
import { B, LegalPage, List, Mail, type LegalSection } from "@/components/legal/LegalPage";
import { COMPANY_NAME, LEGAL_UPDATED } from "@/components/legal/legal-facts";

const DESCRIPTION =
  "How Oakmonte collects, uses, shares and protects personal data, and the rights you have over it.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Oakmonte" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Privacy Policy — Oakmonte" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

// Keep "Who we share it with" in step with the services the code actually
// calls (process.env in src/). Adding analytics, ads or a new processor means
// adding it here before it ships.
const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who We Are",
    body: (
      <>
        <p>
          {COMPANY_NAME} ("Oakmonte", "we", "us") runs the Oakmonte marketplace. We are the data
          controller for the personal data described in this policy, under the Nigeria Data
          Protection Act 2023 (NDPA).
        </p>
        <p>
          For anything about your data, including requests to our data protection contact, email{" "}
          <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What We Collect",
    body: (
      <>
        <p>
          <B>Information you give us</B>
        </p>
        <List>
          <li>
            <B>Account details:</B> email address, display name, username (handle), date of birth,
            account type, and, if you choose to give them, gender and a profile photo. If you sign
            in with Google, we receive your name, email address and profile photo from Google.
          </li>
          <li>
            <B>Store details (sellers):</B> brand name, logo, store locations and addresses,
            storefront design choices, and your product listings, prices and stock.
          </li>
          <li>
            <B>Payout details (sellers):</B> bank name, account number and account name. Account
            numbers are encrypted before we store them.
          </li>
          <li>
            <B>Content:</B> photos, videos, captions and the products you link to your posts.
          </li>
          <li>
            <B>Messages:</B> messages you send to other members and to Oakmonte Support. Message
            text is encrypted before we store it.
          </li>
          <li>
            <B>Orders (once checkout opens):</B> delivery address, phone number, the items you buy
            or sell, and order history.
          </li>
          <li>
            <B>Connected accounts:</B> if you import products from Instagram or Shopify, we store an
            access token for that account (encrypted) and the product details we import.
          </li>
        </List>
        <p>
          <B>Information collected when you use Oakmonte</B>
        </p>
        <List>
          <li>
            <B>Activity:</B> what you post, like, follow, save and view, used to run your feed and
            recommendations.
          </li>
          <li>
            <B>Technical data:</B> IP address, browser and device type, and server logs, used to
            keep the service working and secure.
          </li>
          <li>
            <B>Settings stored on your device:</B> preferences such as whether you have seen a tip,
            kept in your browser's storage.
          </li>
        </List>
        <p>
          <B>Camera, microphone and location</B>
        </p>
        <List>
          <li>
            The camera and microphone are used only while you are using Oakmonte's camera.
            Recording, filters and editing happen on your device. Only what you choose to post is
            uploaded.
          </li>
          <li>
            Your device's location is only read if you tap "use my current location" when adding a
            store location. We never track your location in the background.
          </li>
        </List>
        <p>
          <B>Payment cards:</B> card payments are handled by Paystack. We never see or store your
          full card details.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How We Use It, and Why",
    body: (
      <>
        <p>The NDPA requires a lawful basis for each use of your data. Ours are:</p>
        <List>
          <li>
            <B>To provide Oakmonte (contract):</B> running your account, storefront, posts,
            messages, orders, payments, payouts and deliveries.
          </li>
          <li>
            <B>To keep Oakmonte safe (legitimate interests):</B> preventing fraud, fake accounts,
            fake reviews and abuse; securing the service; and enforcing our{" "}
            <Link to="/terms" className="underline underline-offset-2">
              Terms
            </Link>
            .
          </li>
          <li>
            <B>To improve Oakmonte (legitimate interests):</B> personalising your feed and
            recommendations, and understanding which features work.
          </li>
          <li>
            <B>To meet legal duties (legal obligation):</B> tax, accounting, consumer protection and
            responding to lawful requests from authorities.
          </li>
          <li>
            <B>With your consent:</B> push notifications, marketing messages and reading your
            device's location. You can withdraw consent at any time, and doing so does not affect
            anything done before.
          </li>
        </List>
        <p>
          We do not sell your personal data, and we do not show third-party advertising based on it.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who We Share It With",
    body: (
      <>
        <p>
          <B>Other users.</B> Your profile, storefront, posts and listings are public. When you
          order, the seller receives your name, delivery address and phone number so they can
          deliver it.
        </p>
        <p>
          <B>Service providers</B> who process data for us, under contracts that require them to
          protect it and use it only for the services they provide:
        </p>
        <List>
          <li>
            <B>Supabase</B> — database, sign-in and file storage.
          </li>
          <li>
            <B>Vercel</B> — website and app hosting.
          </li>
          <li>
            <B>Bunny.net</B> — storage and delivery of photos and videos.
          </li>
          <li>
            <B>Paystack</B> — payments, payouts and bank account verification.
          </li>
          <li>
            <B>Shipbubble</B> — delivery quotes and shipping (receives delivery details for orders).
          </li>
          <li>
            <B>Google</B> — sign-in, if you choose "Continue with Google".
          </li>
          <li>
            <B>Instagram (Meta) and Shopify</B> — only if you connect them to import products.
          </li>
        </List>
        <p>
          <B>Authorities and legal claims.</B> We share data where the law requires it, or where
          needed to protect people's safety or rights, or to establish or defend legal claims.
        </p>
        <p>
          <B>Business transfer.</B> If Oakmonte is merged or sold, your data may pass to the new
          owner, who must protect it under this policy.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International Transfers",
    body: (
      <p>
        Some of our service providers store or process data outside Nigeria, including in the
        European Union and the United States. Where data leaves Nigeria, we rely on the safeguards
        the NDPA allows, such as contracts requiring an adequate level of protection. You can ask us
        for more detail at <Mail />.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and Device Storage",
    body: (
      <p>
        Oakmonte uses only the cookies and browser storage needed to keep you signed in, keep the
        service secure and remember your settings. We do not use advertising cookies or third-party
        analytics trackers. If we ever add them, we will update this policy and ask for your consent
        first where the law requires it.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <List>
        <li>Oakmonte is not for children under 13, and they must not create an account.</li>
        <li>
          Users aged 13 to 17 may only use Oakmonte with the permission of a parent or guardian. You
          must be 16 or over to buy, and 18 or over to sell or receive payouts.
        </li>
        <li>
          If you believe a child under 13, or a minor without a parent's or guardian's permission,
          has given us personal data, contact <Mail /> and we will delete it.
        </li>
      </List>
    ),
  },
  {
    id: "retention",
    title: "How Long We Keep It",
    body: (
      <>
        <p>
          We keep your data for as long as your account is open. When you delete your account, we
          delete or anonymise your personal data within 30 days, except:
        </p>
        <List>
          <li>
            records of orders, payments and payouts, which we keep for 6 years after the transaction
            to meet Nigerian tax and accounting rules;
          </li>
          <li>
            data needed for an ongoing dispute, investigation or legal claim, kept until it is
            resolved;
          </li>
          <li>copies in backups, which are overwritten within 90 days.</li>
        </List>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your Rights",
    body: (
      <>
        <p>Under the NDPA you have the right to:</p>
        <List>
          <li>be told how your data is used (this policy);</li>
          <li>get a copy of your personal data;</li>
          <li>have inaccurate data corrected;</li>
          <li>have your data deleted;</li>
          <li>restrict or object to how we use your data;</li>
          <li>receive your data in a portable format;</li>
          <li>withdraw consent at any time where we rely on it;</li>
          <li>
            not be subject to decisions made solely by automated processing that significantly
            affect you.
          </li>
        </List>
        <p>
          You can edit most of your details in the app and delete your account in Settings. For
          anything else, email <Mail />. We will respond within 30 days and may need to confirm your
          identity first.
        </p>
        <p>
          If you are unhappy with how we handle your data, please tell us first. You also have the
          right to complain to the Nigeria Data Protection Commission (NDPC).
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How We Protect It",
    body: (
      <>
        <p>
          Data is encrypted in transit. Messages, payout account numbers and connected-account
          tokens are additionally encrypted before they are stored. Access to personal data inside
          Oakmonte is limited to what each part of the service needs.
        </p>
        <p>
          No system is perfectly secure. If a data breach is likely to put your rights at risk, we
          will notify the NDPC and, where required, you, as the NDPA requires.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    body: (
      <p>
        We will update this policy when our practices change. For important changes we will tell you
        in the app or by email before they take effect. The date at the top shows when it was last
        updated.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {COMPANY_NAME}, Nigeria. Email: <Mail />.
      </p>
    ),
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      summary={
        <>
          <p>
            We collect what we need to run Oakmonte: your account, what you post, your messages,
            and, once checkout opens, your orders. Messages and bank details are encrypted.
          </p>
          <p>
            We don't sell your data, we don't run ad trackers, and we only share what's needed with
            the services that run Oakmonte and the sellers who deliver your orders. You can see,
            correct or delete your data at any time.
          </p>
        </>
      }
      sections={SECTIONS}
    />
  );
}
