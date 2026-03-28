import { ArrowRight, LogIn } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";

interface HeroSceneProps {
  isSignedIn: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

const logLines = [
  "[triage] ssh ubuntu@ec2-12-34-56-78.compute.amazonaws.com",
  "[tail] docker logs --tail 200 web",
  "[error] payment webhook 500 after checkout session recovery",
  "[decision] open Daytona workspace with GPT-5.4",
  "[action] patch server/client mismatch and push hotfix",
  "[deploy] manual redeploy complete, monitor for regressions",
];

export const HeroScene = ({
  isSignedIn,
  onPrimaryAction,
  onSecondaryAction,
}: HeroSceneProps) => {
  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-ink text-sand">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,234,217,0.2),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(118,209,168,0.12),transparent_24%),linear-gradient(180deg,#0a1614_0%,#07110f_52%,#050c0b_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(244,234,217,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(244,234,217,0.03)_1px,transparent_1px)] bg-[size:100%_8rem,8rem_100%] opacity-45" />
      <div className="absolute inset-x-0 bottom-0 h-[42vh] overflow-hidden lg:hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,15,0),rgba(7,17,15,0.68)_20%,rgba(5,12,11,0.94)_100%)]" />
        <div className="absolute inset-x-6 bottom-10 space-y-3 font-mono text-[0.72rem] leading-6 text-sand/38">
          {logLines.slice(0, 4).map((line) => (
            <p key={`mobile-${line}`}>{line}</p>
          ))}
        </div>
      </div>
      <div className="absolute inset-y-0 right-[-12vw] hidden w-[72vw] overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,rgba(255,133,89,0.12),rgba(7,17,15,0.16))] shadow-hero lg:block">
        <div className="absolute inset-0 animate-terminal-drift">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,234,217,0.08),transparent_22%,transparent_78%,rgba(118,209,168,0.08))]" />
          <div className="absolute inset-x-0 top-[10%] h-px bg-white/20" />
          <div className="absolute inset-x-0 top-[10.2%] h-[74%] bg-[linear-gradient(180deg,rgba(5,12,11,0.18),rgba(5,12,11,0.72))]" />
          <div className="absolute left-[12%] top-[18%] h-3 w-3 rounded-full bg-ember/70" />
          <div className="absolute left-[15.2%] top-[18%] h-3 w-3 rounded-full bg-sand/55" />
          <div className="absolute left-[18.4%] top-[18%] h-3 w-3 rounded-full bg-moss/70" />
          <div className="absolute left-[12%] top-[26%] space-y-4 font-mono text-[0.92rem] leading-7 text-sand/70">
            {logLines.map((line) => (
              <p key={line} className="max-w-[44rem]">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <header className="relative z-10 px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="mx-auto max-w-6xl">
          <BrandMark />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center px-6 pb-20 pt-12 sm:px-10">
        <div className="max-w-3xl animate-hero-rise pb-[18vh] lg:pb-0">
          <p className="font-display text-[clamp(4.2rem,19vw,10.5rem)] font-semibold uppercase tracking-[-0.06em] text-sand">
            Vibefix
          </p>
          <h1 className="max-w-2xl font-serif text-[clamp(2.1rem,5vw,4.65rem)] font-semibold leading-[0.96] text-sand">
            Your launch keeps breathing even when the vibecode breaks.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-sand/72 sm:text-lg">
            This demo operator signs the founder in with Google, SSHes into EC2,
            tails Docker logs, and only opens a Daytona repair run when the app is
            actually broken.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-sand px-7 font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink transition hover:scale-[1.02] hover:bg-white"
            >
              {isSignedIn ? "Open Setup" : "Continue with Google"}
              {isSignedIn ? <ArrowRight className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex h-14 items-center rounded-full border border-sand/20 px-7 font-display text-sm font-semibold uppercase tracking-[0.18em] text-sand transition hover:border-sand/40 hover:bg-sand/5"
            >
              See operator flow
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
