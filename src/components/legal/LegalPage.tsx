import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LegalHeader } from "@/components/LegalHeader";
import { COMPANY_NAME, CONTACT_EMAIL } from "./legal-facts";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** The shared shell of the Terms and Privacy pages: title, plain-language
 *  summary, a contents list that tracks the section in view, and numbered
 *  sections. Content lives in the route files; layout lives here, once. */
export function LegalPage({
  title,
  updated,
  summary,
  sections,
}: {
  title: string;
  updated: string;
  summary: ReactNode;
  sections: LegalSection[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <LegalHeader />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10">
          <p className="mb-4 text-[10px] tracking-[0.25em] uppercase opacity-50">Legal</p>
          <h1 className="font-display text-5xl leading-none tracking-tight md:text-7xl">{title}</h1>
          <p className="mt-6 text-xs tracking-widest uppercase opacity-60">
            Last updated: {updated}
          </p>
        </div>

        <div className="mb-12 max-w-3xl border border-brand-text/15 bg-brand-muted/30 p-6 md:p-8">
          <p className="mb-3 text-[10px] tracking-[0.25em] uppercase opacity-60">
            In plain language
          </p>
          <div className="space-y-3 text-sm leading-relaxed md:text-base">{summary}</div>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[220px_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start print:hidden">
            <p className="mb-4 text-[10px] tracking-[0.25em] uppercase opacity-50">Contents</p>
            <nav className="flex flex-col gap-2 text-sm">
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`border-l-2 py-1 pl-3 transition-colors ${
                    active === s.id
                      ? "border-brand-accent text-brand-text"
                      : "border-transparent opacity-60 hover:border-brand-text/30 hover:opacity-100"
                  }`}
                >
                  <span className="mr-2 opacity-60">{i + 1}.</span>
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="max-w-2xl space-y-14 text-sm leading-relaxed md:text-[15px]">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <a href={`#${s.id}`} className="group mb-4 block no-underline">
                  <p className="mb-2 text-[10px] tracking-[0.25em] uppercase opacity-50">
                    Section {i + 1}
                  </p>
                  <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                    {s.title}
                    <span className="ml-2 align-middle text-lg text-brand-accent opacity-0 transition-opacity group-hover:opacity-40">
                      #
                    </span>
                  </h2>
                </a>
                <div className="space-y-4">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </div>

      <footer className="flex flex-col items-start justify-between gap-6 border-t border-brand-text/5 px-4 py-12 text-[10px] tracking-widest uppercase opacity-50 sm:px-6 md:flex-row md:items-center lg:px-8 print:hidden">
        <div>
          © {new Date().getFullYear()} {COMPANY_NAME}
        </div>
        <div className="flex gap-8">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-brand-accent">{children}</ul>;
}

export function B({ children }: { children: ReactNode }) {
  return <span className="font-medium">{children}</span>;
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
}
