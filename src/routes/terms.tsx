import { createFileRoute, Link } from "@tanstack/react-router";
import { B, LegalPage, List, Mail, type LegalSection } from "@/components/legal/LegalPage";
import { COMPANY_NAME, LEGAL_UPDATED } from "@/components/legal/legal-facts";

const DESCRIPTION =
  "The Terms of Service for Oakmonte, a content-driven fashion marketplace connecting buyers, sellers and creators.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Oakmonte" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Terms of Service — Oakmonte" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

// Pricing facts mirror src/lib/pricing-fees.ts (COMMISSION_RATE and the
// Paystack constants). Change them there and here together.
const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About These Terms",
    body: (
      <>
        <p>
          These Terms of Service ("Terms") are an agreement between you and {COMPANY_NAME}, a
          company being incorporated in the Federal Republic of Nigeria ("Oakmonte", "we", "us" or
          "our"). They govern your use of the Oakmonte website, web app and related services (the
          "Platform").
        </p>
        <p>
          By creating an account or using the Platform, you agree to these Terms and to our{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Platform. If you use Oakmonte on behalf of a
          business, you confirm you are authorised to bind that business to these Terms.
        </p>
      </>
    ),
  },
  {
    id: "pre-launch",
    title: "Before Full Launch",
    body: (
      <>
        <p>
          Oakmonte is in an early-access period. During this period, checkout and payments are
          switched off, and some features (including the cart, messaging other members, drops and
          linking other stores' products) are marked as unavailable. No purchase can be made and no
          money changes hands on the Platform until we announce full launch.
        </p>
        <p>
          Features may change, be added or be removed while we prepare for launch. The sections of
          these Terms about buying, selling and payments apply from the moment those features are
          switched on.
        </p>
      </>
    ),
  },
  {
    id: "what-oakmonte-is",
    title: "What Oakmonte Is",
    body: (
      <>
        <p>Oakmonte is a marketplace where people discover fashion through content:</p>
        <List>
          <li>
            <B>Buyers</B> discover products through posts and storefronts and buy them.
          </li>
          <li>
            <B>Sellers</B> run storefronts and list and fulfil their own products.
          </li>
          <li>
            <B>Creators</B> post content and link it to products listed on the Platform.
          </li>
        </List>
        <p>
          Oakmonte provides the marketplace. We are not the manufacturer, owner or seller of the
          products listed by sellers. When you buy a product, the contract of sale is between you
          and the seller. Sellers are responsible for their listings, products and deliveries.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Eligibility and Accounts",
    body: (
      <>
        <List>
          <li>You must be at least 13 years old to create an account.</li>
          <li>
            If you are under 18, you may only use Oakmonte with the permission of a parent or
            guardian, who agrees to these Terms on your behalf.
          </li>
          <li>You must be at least 16 years old to buy on Oakmonte.</li>
          <li>You must be at least 18 years old to open a store, sell, or receive payouts.</li>
          <li>
            You must give accurate information when you register and keep it up to date. You are
            responsible for everything that happens on your account, and for keeping your sign-in
            details secure. Tell us straight away at <Mail /> if you think your account has been
            accessed without your permission.
          </li>
          <li>
            A seller account comes with two profiles: a personal profile for the owner and a profile
            for the store. Both are covered by these Terms, and the seller is responsible for
            activity on both.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "content",
    title: "Your Content",
    body: (
      <>
        <p>
          You keep ownership of the photos, videos, text and other material you post ("your
          content").
        </p>
        <p>
          By posting, you give Oakmonte a worldwide, non-exclusive, royalty-free licence to host,
          store, copy, adapt (for example resizing, cropping or converting formats), display and
          distribute your content on the Platform, and to show it in promotion of the Platform. This
          licence ends when you delete the content or your account, except for copies kept in
          backups for a limited time, copies we must keep by law, and content other users have
          already shared within the Platform.
        </p>
        <p>
          You confirm that you own your content or have every permission needed to post it,
          including the rights of anyone who appears in it and of any music, images or other
          material within it, and that it does not break the law or these Terms. We may remove
          content, or limit who can see it, if we believe it breaks these Terms or the law.
        </p>
      </>
    ),
  },
  {
    id: "buying",
    title: "Buying",
    body: (
      <>
        <List>
          <li>
            Prices are set by sellers and shown in Nigerian Naira (NGN). The price and any delivery
            charge are shown before you pay.
          </li>
          <li>
            Payment is taken when you place an order and held until the order is complete (see
            Payments and Held Funds). Payments are processed by Paystack. Oakmonte does not see or
            store your full card details.
          </li>
          <li>You are responsible for giving a correct delivery address and contact details.</li>
          <li>
            <B>Returns.</B> If an item arrives damaged, is the wrong item, or is materially
            different from its listing, you may request a return within 7 days of delivery. In those
            cases the seller pays for return delivery, and once the seller receives the item back
            you are refunded to your original payment method. Returns for a change of mind are only
            available where the seller's own listing offers them.
          </li>
          <li>
            Nothing in these Terms limits the rights you have as a consumer under the Federal
            Competition and Consumer Protection Act 2018 or any other law that cannot be excluded by
            agreement.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "selling",
    title: "Selling",
    body: (
      <>
        <List>
          <li>
            Listings must be accurate and honest, including photos, descriptions, sizes, condition,
            price and availability.
          </li>
          <li>
            You may only sell genuine products that you have the right to sell. Counterfeit, replica
            or stolen goods are forbidden.
          </li>
          <li>
            You must ship orders on time, use the delivery details provided, and respond to buyers
            and to Oakmonte about your orders.
          </li>
          <li>
            <B>Fees.</B> Oakmonte charges a commission of 3% of the price paid for each item sold.
            Paystack's payment processing fee is also deducted from the sale: currently 1.5% of the
            amount paid plus ₦100 (the ₦100 is waived on amounts under ₦2,500), capped at ₦2,000 per
            transaction. The amount you will receive is shown when you set your price. We will give
            you at least 14 days' notice before changing our commission.
          </li>
          <li>Payouts are made to a Nigerian bank account in your name or your business's name.</li>
          <li>
            You are responsible for your own taxes, and for complying with the laws that apply to
            your products and your business.
          </li>
          <li>
            You may not ask buyers to pay you outside Oakmonte for a sale that began on the
            Platform.
          </li>
          <li>
            We may hold back a payout while an order is disputed, or if we reasonably suspect fraud
            or a breach of these Terms. Accounts with repeated late, cancelled or disputed orders
            may be shown less prominently, suspended or closed.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "creators",
    title: "Creators",
    body: (
      <List>
        <li>
          Creators may link their posts to products listed on Oakmonte. How creators are paid for
          sales through their content will be set out in a separate creator policy before that
          feature launches.
        </li>
        <li>
          If you are paid or given anything to feature a product, you must say so clearly in the
          post, as required by Nigerian advertising and consumer protection rules.
        </li>
        <li>
          You may not link your content to products in a way that misleads people about the product
          or about your relationship with the seller.
        </li>
      </List>
    ),
  },
  {
    id: "prohibited",
    title: "Prohibited Conduct and Items",
    body: (
      <>
        <p>You must not use Oakmonte to:</p>
        <List>
          <li>break any law, or help anyone else to;</li>
          <li>
            sell or promote counterfeit goods, stolen goods, weapons, drugs, alcohol or tobacco
            products, sexually explicit material, or anything else that is illegal to sell in
            Nigeria;
          </li>
          <li>
            post content that is sexual involving anyone under 18, hateful, harassing, threatening,
            violent, or that invades someone's privacy;
          </li>
          <li>impersonate any person, brand or store, or misrepresent your connection to them;</li>
          <li>
            post fake reviews, buy or fake likes, followers, comments or shares, or invent scarcity;
          </li>
          <li>take payments outside the Platform for sales that began on it;</li>
          <li>post content you do not have the rights to;</li>
          <li>
            send spam, collect other users' personal information without permission, or use bots,
            scrapers or automated tools on the Platform;
          </li>
          <li>
            interfere with, probe or try to get around the Platform's security or features,
            including features marked as unavailable.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments and Held Funds",
    body: (
      <>
        <p>
          Payments are processed by Paystack, a licensed payment service provider. Oakmonte is not a
          bank. Paystack's own terms also apply to your payments.
        </p>
        <p>
          When a buyer pays, the funds are held until the order is complete. They are released to
          the seller, less the fees in the Selling section, 72 hours after the buyer confirms
          delivery, or 7 days after delivery if the buyer neither confirms delivery nor raises a
          problem in that time. If the buyer raises a problem, the funds stay held until it is
          resolved.
        </p>
        <p>
          If a payment is reversed by the buyer's bank or card issuer, or found to be fraudulent, we
          may recover the amount from the seller's future payouts.
        </p>
      </>
    ),
  },
  {
    id: "disputes-between-users",
    title: "Problems with an Order",
    body: (
      <>
        <p>
          If something goes wrong with an order, the buyer and seller should first try to sort it
          out between them. If they cannot, either can ask Oakmonte to review it. We may ask both
          sides for evidence such as order details, delivery tracking, photos and messages.
        </p>
        <p>
          We will decide in good faith whether held funds go to the seller or are refunded to the
          buyer. This decides only what happens to funds we hold; it does not stop either person
          from using any legal rights they have against the other.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual Property and Takedowns",
    body: (
      <>
        <p>
          The Oakmonte name, logo, Platform design, themes and software belong to {COMPANY_NAME} and
          may not be used without our written permission.
        </p>
        <p>
          If you believe something on Oakmonte infringes your copyright, trade mark or other rights,
          email <Mail /> with: your contact details, the work or mark you own, a link to the content
          you are reporting, and a statement that you believe in good faith the use is not
          authorised. We will review it promptly and may remove the content. We close the accounts
          of people who repeatedly infringe others' rights.
        </p>
      </>
    ),
  },
  {
    id: "communications",
    title: "Messages and Notifications",
    body: (
      <List>
        <li>
          We will send you messages about your account and orders. These are part of the service.
          Marketing messages are only sent if you agree to them, and you can stop them at any time.
        </li>
        <li>
          Push notifications are only sent if you turn them on, and you can turn them off in your
          device or browser settings.
        </li>
        <li>
          Messages you send through Oakmonte are stored encrypted. We may review messages that are
          reported to us, or where we need to in order to investigate fraud or abuse or comply with
          the law.
        </li>
      </List>
    ),
  },
  {
    id: "termination",
    title: "Suspension and Closing Accounts",
    body: (
      <List>
        <li>
          You can delete your account at any time in Settings. Orders already placed still need to
          be completed, refunded or resolved under these Terms.
        </li>
        <li>
          We may suspend or close an account, remove content, or withhold access to features if we
          reasonably believe the account has broken these Terms or the law, or puts other users or
          Oakmonte at risk. Where it is safe and lawful to do so, we will tell you why and give you
          a chance to respond.
        </li>
      </List>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        We work hard to keep Oakmonte running well, but the Platform is provided "as is" and "as
        available". To the extent the law allows, we do not promise that it will always be available
        or free of errors, and we are not responsible for the products sellers list, what users
        post, or what users do. Estimates the Platform gives you, such as suggested product weights
        or delivery costs, are guides only and should be checked.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    body: (
      <>
        <p>To the extent the law allows:</p>
        <List>
          <li>
            Oakmonte is not liable for any indirect or consequential loss, or for loss of profit,
            revenue, business, goodwill or data.
          </li>
          <li>
            Our total liability to you for all claims connected with the Platform in any 12-month
            period is limited to the greater of the fees you paid to Oakmonte in that period or
            ₦50,000.
          </li>
        </List>
        <p>
          Nothing in these Terms limits liability for fraud, for death or personal injury caused by
          negligence, or for anything else that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Your Responsibility to Us",
    body: (
      <p>
        If someone makes a claim against Oakmonte because of your content, your products, your
        breach of these Terms or your breach of the law, you agree to cover the reasonable losses
        and costs we incur as a result.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law and Disputes",
    body: (
      <>
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
        <p>
          If you have a dispute with Oakmonte, please contact us first at <Mail />. We will try to
          resolve it with you within 30 days. If we cannot, the dispute will be decided by the
          courts of Lagos State, Nigeria, unless the law gives you the right to bring it elsewhere.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    body: (
      <p>
        We may update these Terms. For important changes we will tell you in the app or by email at
        least 14 days before they take effect. Changes needed for legal or security reasons may take
        effect sooner. If you keep using Oakmonte after a change takes effect, you accept the
        updated Terms. If you do not agree, you can delete your account.
      </p>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <List>
        <li>
          These Terms and the Privacy Policy are the whole agreement between you and Oakmonte about
          the Platform.
        </li>
        <li>If any part of these Terms is found to be unenforceable, the rest still applies.</li>
        <li>If we do not enforce a right straight away, we can still enforce it later.</li>
        <li>
          You may not transfer your rights under these Terms. We may transfer ours to a company that
          takes over the Platform, and will tell you if we do.
        </li>
      </List>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {COMPANY_NAME}, Nigeria. Email: <Mail />. You can also message Oakmonte Support from the
        Messages page in the app.
      </p>
    ),
  },
];

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      summary={
        <>
          <p>
            Oakmonte is a marketplace: sellers sell their own products, creators link their posts to
            them, and buyers buy from the seller. When checkout opens, payments are held until the
            order is complete, and Oakmonte takes a 3% commission from sellers.
          </p>
          <p>
            You keep ownership of what you post. Be honest, sell genuine products, and don't take
            payments off the Platform. Checkout is locked until full launch.
          </p>
        </>
      }
      sections={SECTIONS}
    />
  );
}
