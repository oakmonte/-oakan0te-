import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/no-account")({
  head: () => ({
    // White page, so the iOS status strip must be white too — the root
    // default is #000000 and would otherwise paint a black band above it.
    meta: [{ title: "Welcome to Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: NoAccountPage,
});

// Reached two ways: post-auth, when resolvePostAuthRedirect finds a signed-in
// user with no profile yet; and pre-auth, as the "create a new account" exit
// from /sign-in. Either way the three buttons below just carry the visitor
// into an AuthPanel flow with intent set — no session is required to see them.
function NoAccountPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/favicon.png" alt="Oakmonte" className="h-9 w-auto" />
        </Link>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors"
        >
          ← Back
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight mb-3">
            You don't seem to have an account with us
          </h1>
          <p className="text-sm text-brand-text/70 mb-10">
            Tell us what brings you to Oakmonte, and we'll get you set up.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/set-up-store" })}
              className="w-full text-center px-6 py-4 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300"
            >
              Set Up A Store
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/become-a-creator" })}
              className="w-full text-center px-6 py-4 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300"
            >
              Become a Creator
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/become-a-curator" })}
              className="w-full text-center px-6 py-4 bg-brand-bg border border-brand-text text-[11px] uppercase tracking-widest font-bold hover:border-brand-accent hover:text-brand-accent transition-colors duration-300"
            >
              Define Your Wardrobe
            </button>
          </div>

          <p className="mt-5 text-xs text-brand-text/60 leading-relaxed">
            You can switch between these later.
          </p>
        </div>
      </main>
    </div>
  );
}
