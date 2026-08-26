import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WELLCANVAS_VERSION } from "@/lib/version";

const sections = [
  {
    title: "What is WellCanvas?",
    body: "WellCanvas is a free personal tracker for food, hydration, activity and measurements. It works without registration, and completing a profile is optional.",
  },
  {
    title: "No account required",
    body: "You can begin immediately and record only what is useful to you.",
  },
  {
    title: "Stored locally",
    body: "Your records are stored in this browser by default rather than automatically uploaded to a central account. Clearing browser storage may remove them.",
  },
  {
    title: "Designed around real habits",
    body: "Reuse familiar foods, meals, restaurant orders, activities and personal trackers. Start with broad estimates and improve them later.",
  },
  {
    title: "Make it yours",
    body: "WellCanvas is both an application and a customisable foundation. Its source and documentation can be given to coding assistants such as Codex or Claude to change the dashboard, visual style, food library or workflows.",
    id: "documentation",
  },
  {
    title: "Sharing",
    body: "Food packs can be shared without including private health history, profile details, measurements, activities or daily logs.",
  },
  {
    title: `WellCanvas v${WELLCANVAS_VERSION}`,
    body: "No account required. Local-first. No advertising. Free and open source. Your data can be exported. Use the tracker as it is or modify it.",
  },
  {
    title: "Open source",
    body: "WellCanvas is released under the MIT License.",
    id: "licence",
  },
  {
    title: "Not medical care",
    body: "WellCanvas organises personal records and broad estimates. It does not diagnose conditions or replace professional medical or nutritional advice.",
  },
];

export default function AboutPage() {
  return (
    <main className="wc-page mx-auto flex w-full max-w-3xl flex-col">
      <PageHeader
        subtitle="A local-first health tracker you can make your own."
        title="About WellCanvas"
      />
      <article className="wc-section p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-secondary-outline" href="#licence">
            View licence
          </a>
          <a className="btn btn-secondary-outline" href="#documentation">
            Project documentation
          </a>
          <Link className="btn btn-primary-dark" href="/settings">
            Back to Settings
          </Link>
        </div>

        <div className="my-6 border-t border-stone-200" />

        <div className="grid gap-5">
          {sections.map((section, index) => (
            <section
              className={index > 0 ? "border-t border-stone-100 pt-5" : ""}
              id={section.id}
              key={section.title}
            >
              <h2 className="text-base font-semibold text-stone-950">
                {section.title}
              </h2>
              <p className="mt-2 leading-7 text-stone-600">{section.body}</p>
              {section.id === "documentation" && (
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Project documentation is available in the local repository under
                  the docs folder.
                </p>
              )}
              {section.id === "licence" && (
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  The root LICENSE file contains the complete MIT License text.
                </p>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
