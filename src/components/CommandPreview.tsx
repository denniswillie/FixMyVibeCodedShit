import { buildAgentRunbook, buildProbeCommand, isDraftReady } from "@/lib/onboarding";
import type { OnboardingDraft } from "@/types/onboarding";

interface CommandPreviewProps {
  value: OnboardingDraft;
}

export const CommandPreview = ({ value }: CommandPreviewProps) => {
  const ready = isDraftReady(value);
  const runbook = buildAgentRunbook(value);

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-[#111c1a] px-6 py-7 text-sand shadow-panel animate-panel-reveal">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sand/42">
        Step 3
      </p>
      <h2 className="mt-3 font-serif text-3xl font-semibold text-sand">
        Preview the runbook.
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-sand/68">
        This is the exact operator shape you described: only check logs, no-op
        when healthy, and spin up a Daytona coding run when the server starts
        breaking.
      </p>

      <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/30 p-5">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/42">
          SSM probe command
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 text-sand/84">
          <code>{buildProbeCommand(value)}</code>
        </pre>
      </div>

      <div className="mt-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/42">
          Agent sequence
        </p>
        <ol className="mt-4 space-y-4">
          {runbook.map((line) => (
            <li key={line} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 font-display text-xs font-semibold uppercase tracking-[0.16em] text-sand/70">
                {runbook.indexOf(line) + 1}
              </span>
              <p className="pt-1 text-sm leading-7 text-sand/74">{line}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.03] p-5">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/42">
          Access note
        </p>
        <p className="mt-3 text-sm leading-7 text-sand/72">
          The worker now owns the AWS hop directly. Daytona only sees the log
          excerpt, the repo, and the repair brief, which avoids the shared-runner
          EC2 networking problems we hit earlier.
        </p>
      </div>

      <p className="mt-6 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/55">
        {ready ? "Demo can hand this brief to the worker." : "Fill the required credentials to arm the demo."}
      </p>
    </section>
  );
};
