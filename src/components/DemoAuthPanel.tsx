import { Chrome, RotateCcw } from "lucide-react";

import type { AuthenticatedUser } from "@/types/onboarding";

interface DemoAuthPanelProps {
  user: AuthenticatedUser | null;
  isLoading?: boolean;
  message?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const DemoAuthPanel = ({
  user,
  isLoading = false,
  message = null,
  onSignIn,
  onSignOut,
}: DemoAuthPanelProps) => {
  if (!user) {
    return (
      <div className="rounded-[2rem] border border-ink/10 bg-white px-6 py-7 shadow-panel animate-panel-reveal">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
          Step 1
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
          Identify the founder.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-ink/68">
          Use the real Google OAuth flow. After sign-in, the website loads the
          current session from the Express backend and unlocks the operator
          settings for that user.
        </p>
        {message ? (
          <p className="mt-4 rounded-[1.2rem] bg-ink/5 px-4 py-3 text-sm leading-7 text-ink/72">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className="mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-ink px-6 font-display text-sm font-semibold uppercase tracking-[0.16em] text-sand transition hover:bg-[#10211e]"
        >
          <Chrome className="h-4 w-4" />
          {isLoading ? "Checking session" : "Continue with Google"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-ink/10 bg-white px-6 py-7 shadow-panel animate-panel-reveal">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            Signed in
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
            {user.fullName || user.name}
          </h2>
          <p className="mt-2 text-sm leading-7 text-ink/68">
            {user.email}
            <span className="mx-2 text-ink/25">/</span>
            {user.company || "Google account connected"}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-moss/14 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink">
            <span className="h-2.5 w-2.5 animate-signal-pulse rounded-full bg-moss" />
            Session ready
          </span>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-[1.2rem] bg-ink/5 px-4 py-3 text-sm leading-7 text-ink/72">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 px-5 font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink/72 transition hover:border-ink/20 hover:bg-ink/5"
      >
        <RotateCcw className="h-4 w-4" />
        Reset demo session
      </button>
    </div>
  );
};
