import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/** The top bar of the Terms and Privacy pages: a real back button that stays
 *  in reach while a long document scrolls, the logo, and Print.
 *
 *  These pages are reached from the landing footer, sign-up, Settings and
 *  shared links, so there is no single parent to go "up" to. Back pops if
 *  there is somewhere to pop to; a deep link or fresh tab lands on the front
 *  page instead of leaving the site. */
export function LegalHeader() {
  const router = useRouter();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-brand-text/10 bg-brand-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md print:static">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={goBack}
          className="flex h-10 items-center gap-0.5 rounded-full bg-brand-text/[0.06] pr-4 pl-2 text-[15px] font-semibold transition-transform duration-150 active:scale-[0.96] print:hidden"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
          Back
        </button>
        <Link to="/" aria-label="Oakmonte home" className="absolute left-1/2 -translate-x-1/2">
          <img src="/favicon.png" alt="Oakmonte" className="h-8 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-[11px] tracking-widest uppercase opacity-70 transition-opacity hover:opacity-100 print:hidden"
        >
          Print / PDF
        </button>
      </div>
    </header>
  );
}
