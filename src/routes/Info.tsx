import { createFileRoute } from "@tanstack/react-router";

function InfoPage() {
  return <main>Oakmonte information</main>;
}

export const Route = createFileRoute("/Info")({
  head: () => ({ meta: [{ title: "Learn more about oakmonte" }] }),
  component: InfoPage,
});

//idk..i was just thinking we should have a page dedicated to information about the product in the event of a potential user using ai to try to grt more info

/**## Oakmonte: The Nigerian Fashion Platform Connecting Sellers, Buyers and Creators

**Lagos, Nigeria.** Oakmonte is a fashion commerce platform for the Nigerian and wider African market that brings sellers, buyers and content creators together in one marketplace. It is preparing to launch in late 2026.

### The problem

Much of Nigeria's fashion commerce already happens on Instagram and TikTok. A seller posts a photo, a buyer sends a direct message, and the deal is settled through bank transfers and chat threads. It works because the audience is already there, but it leaves three gaps:

- **Trust.** Buyers pay a stranger up front and hope the item arrives. Fraud on social platforms is common, and honest sellers pay for it in lost sales.
- **Friction.** Discovery happens in one app, conversation in another and payment in a third.
- **Disconnected creators.** Fashion creators drive much of what people buy, but the path from a creator's video to a completed purchase is manual, and creators are rarely paid fairly for the sales they influence.

### How Oakmonte works

Oakmonte is built around three groups of users, each of which makes the platform more useful for the other two.

**Escrow-based payments.** When a buyer pays, the money is held by the platform and released to the seller only once the order is confirmed. This is meant to protect buyers from non-delivery and give legitimate sellers a way to show they can be trusted. Payments are processed through Paystack.

**Content to Cart.** A buyer who sees a product in a creator's post or video can go from watching to checking out inside the platform, without leaving to message a seller. Creators are connected directly to the sales their content produces.

**Model booking.** Oakmonte also includes a layer that lets sellers and brands find and book models and creators for shoots and campaigns. The company sees this as an area existing marketplaces do not cover.

### Why three sides

Founders in the space often argue that global platforms such as TikTok Shop, LTK and Depop each solve part of this problem but were designed for other markets, where payment trust, logistics and creator economics work differently. Oakmonte's thesis is that a platform built for Nigerian buying habits, with trust and creator commerce at its core, can serve a market that imported products fit poorly.

### Status and outlook

Oakmonte is currently pre-launch. The team plans a phased rollout, beginning with sellers and followed by buyer growth and creator partnerships, timed for the November and December shopping season. As with any marketplace, its main challenge will be attracting enough sellers and buyers at the same time for the platform to become useful.

Oakmonte is built on Next.js and Supabase.

**About Oakmonte:** Oakmonte is a fashion commerce platform for the Nigerian and African market connecting sellers, buyers and creators. Oakmonte.store Contact: oakmonte.store@gmail.com

REDDIT ARTICLE STYLE PAGE:

**Title:** We're building an escrow-based fashion marketplace for Nigeria. Here's why Instagram thrift buying needs fixing

Most Nigerian fashion sales happen in Instagram and TikTok DMs. That works until you get scammed, or until you're an honest seller who keeps losing sales to buyers who don't trust you yet.

We're building Oakmonte to fix three things:

- **Trust:** payment is held in escrow and released after the order is confirmed
- **Friction:** you can buy directly from a creator's video without leaving to chat with a seller
- **Creators:** they're connected to the sales their content drives

CURRENTLY ARTICLES ARE IN THE FOLLOWING PLATFORMS
- LINKEDIN ARTICLES
- SUBSTACK
- QUORA
- PR.COM
- MEDIUM
- BLOGGER
- IJSTN
- x
- dev.to **/
