import type { ChangeEvent } from "react";

import { getMissingFields, isDraftReady } from "@/lib/onboarding";
import type { OnboardingDraft } from "@/types/onboarding";

interface CredentialsFormProps {
  value: OnboardingDraft;
  disabled: boolean;
  onConnectGitHub: () => void;
  onChange: (nextValue: OnboardingDraft) => void;
}

const inputClassName =
  "mt-2 w-full rounded-[1.15rem] border border-ink/10 bg-[#fbf7f0] px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/28 focus:border-ink/25 focus:bg-white";

const labelClassName =
  "font-display text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/52";

const helperClassName = "mt-2 text-xs leading-6 text-ink/52";

export const CredentialsForm = ({
  value,
  disabled,
  onConnectGitHub,
  onChange,
}: CredentialsFormProps) => {
  const missingFields = getMissingFields(value);
  const ready = isDraftReady(value);
  const githubConnected = Boolean(value.github.connection?.installationId);

  const updateField =
    (section: keyof OnboardingDraft, field: string) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({
        ...value,
        [section]: {
          ...value[section],
          [field]: event.target.value,
        },
      });
    };

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white px-6 py-7 shadow-panel animate-panel-reveal">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            Step 2
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
            Connect the operator.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/68">
            The first Vibefix operator uses direct SSH into EC2 to run
            {" "}
            <span className="mx-1 font-mono text-[0.8rem] text-ink">
              docker logs --tail &lt;num&gt; &lt;service&gt;
            </span>
            . So the website collects the box details and SSH key, not an AWS
            access key.
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] ${
            ready
              ? "bg-moss/16 text-ink"
              : "bg-ember/12 text-ink/78"
          }`}
        >
          {ready ? "Ready for worker pickup" : `${missingFields.length} fields still needed`}
        </span>
      </div>

      <form
        className="mt-8 grid gap-8"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset disabled={disabled} className="grid gap-5">
          <legend className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink">
            GitHub write access
          </legend>
          <div className="rounded-[1.4rem] border border-ink/10 bg-[#f8f1e3] px-5 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className={labelClassName}>GitHub App access</p>
                <p className="mt-2 text-sm leading-7 text-ink/68">
                  Founders install the Vibefix GitHub App and select the repo we
                  can read and write. No pasted personal access token required.
                </p>
                {githubConnected ? (
                  <p className="mt-3 text-xs leading-6 text-ink/56">
                    Connected to{" "}
                    <span className="font-semibold text-ink">
                      {value.github.connection?.accountLogin || "your GitHub account"}
                    </span>
                    {" "}
                    with access to {value.github.connection?.repoCount || 0} repo
                    {value.github.connection?.repoCount === 1 ? "" : "s"}.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-6 text-ink/56">
                    The button opens GitHub so the founder can choose the exact
                    repo installation directly.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onConnectGitHub}
                disabled={disabled}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-center font-display text-xs font-semibold uppercase tracking-[0.16em] text-sand transition hover:bg-[#10211e] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Give us access to your GitHub repo
              </button>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className={labelClassName}>Repository URL</span>
              <input
                value={value.github.repoUrl}
                onChange={updateField("github", "repoUrl")}
                className={inputClassName}
                placeholder="https://github.com/acme/fragile-launch"
              />
            </label>
            <label>
              <span className={labelClassName}>Default branch</span>
              <input
                value={value.github.branch}
                onChange={updateField("github", "branch")}
                className={inputClassName}
                placeholder="main"
              />
            </label>
          </div>
          <p className={helperClassName}>
            Keep the repo URL here aligned with the repo you selected during the
            GitHub App install flow so the repair worker patches the right codebase.
          </p>
        </fieldset>

        <fieldset disabled={disabled} className="grid gap-5 border-t border-ink/8 pt-7">
          <legend className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink">
            EC2 log access
          </legend>
          <div className="grid gap-5 md:grid-cols-3">
            <label className="md:col-span-2">
              <span className={labelClassName}>Host</span>
              <input
                value={value.ssh.host}
                onChange={updateField("ssh", "host")}
                className={inputClassName}
                placeholder="ec2-12-34-56-78.compute.amazonaws.com"
              />
            </label>
            <label>
              <span className={labelClassName}>SSH port</span>
              <input
                value={value.ssh.port}
                onChange={updateField("ssh", "port")}
                className={inputClassName}
                placeholder="22"
              />
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <label>
              <span className={labelClassName}>SSH user</span>
              <input
                value={value.ssh.username}
                onChange={updateField("ssh", "username")}
                className={inputClassName}
                placeholder="ubuntu"
              />
            </label>
            <label>
              <span className={labelClassName}>Docker service</span>
              <input
                value={value.ssh.dockerService}
                onChange={updateField("ssh", "dockerService")}
                className={inputClassName}
                placeholder="web"
              />
            </label>
            <label>
              <span className={labelClassName}>Tail lines</span>
              <input
                value={value.ssh.logTail}
                onChange={updateField("ssh", "logTail")}
                className={inputClassName}
                placeholder="200"
              />
            </label>
          </div>
          <label>
            <span className={labelClassName}>SSH private key</span>
            <textarea
              value={value.ssh.privateKey}
              onChange={updateField("ssh", "privateKey")}
              className={`${inputClassName} min-h-36 resize-y font-mono text-[0.82rem] leading-6`}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </label>
        </fieldset>

        <fieldset disabled={disabled} className="grid gap-5 border-t border-ink/8 pt-7">
          <legend className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink">
            Worker cadence
          </legend>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className={labelClassName}>Every N minutes</span>
              <input
                value={value.schedule.everyMinutes}
                onChange={updateField("schedule", "everyMinutes")}
                className={inputClassName}
                placeholder="15"
              />
            </label>
            <label>
              <span className={labelClassName}>Timezone</span>
              <input
                value={value.schedule.timezone}
                onChange={updateField("schedule", "timezone")}
                className={inputClassName}
                placeholder="Europe/Dublin"
              />
            </label>
          </div>
          <p className={helperClassName}>
            The worker can translate this directly into the `scheduled_run_time`
            style cadence you already use elsewhere.
          </p>
        </fieldset>
      </form>

      {disabled ? (
        <p className="mt-8 text-sm leading-7 text-ink/56">
          Sign in first so the demo can attach the credentials to a founder
          session.
        </p>
      ) : null}
    </section>
  );
};
