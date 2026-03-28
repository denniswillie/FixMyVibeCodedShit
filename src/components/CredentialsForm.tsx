import type { ChangeEvent } from "react";
import { useState } from "react";

import { parseAwsCredentialsFile } from "@/lib/awsCredentials";
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
  const [awsUploadMessage, setAwsUploadMessage] = useState<string | null>(null);
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

  const handleAwsCredentialsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const parsed = parseAwsCredentialsFile(await file.text());
      onChange({
        ...value,
        aws: {
          ...value.aws,
          accessKeyId: parsed.accessKeyId,
          secretAccessKey: parsed.secretAccessKey,
          sessionToken: parsed.sessionToken,
        },
      });
      setAwsUploadMessage(`${file.name} parsed. Review the instance details below and save.`);
    } catch (error) {
      setAwsUploadMessage(
        error instanceof Error ? error.message : "Unable to read that AWS credentials file."
      );
    } finally {
      event.target.value = "";
    }
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
            Keep the setup literal: GitHub App for repo writes, then one AWS
            credentials file with SSM access plus the exact EC2 instance and Docker
            service the worker should inspect.
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
          <p className={helperClassName}>
            Vibefix uses the repositories exposed by the GitHub App install flow,
            so there is no separate repo URL or branch field to keep in sync here.
          </p>
        </fieldset>

        <fieldset disabled={disabled} className="grid gap-5 border-t border-ink/8 pt-7">
          <legend className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink">
            AWS + EC2 log access
          </legend>
          <div className="rounded-[1.4rem] border border-ink/10 bg-[#f8f1e3] px-5 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className={labelClassName}>AWS credentials file</p>
                <p className="mt-2 text-sm leading-7 text-ink/68">
                  Upload the AWS CLI credentials file or IAM access-key CSV for a
                  user that can call SSM on the target instance.
                </p>
                <p className="mt-3 text-xs leading-6 text-ink/56">
                  Vibefix parses the key id, secret, and optional session token from
                  the upload, then pairs them with the target details below.
                </p>
              </div>
              <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-ink px-6 text-center font-display text-xs font-semibold uppercase tracking-[0.16em] text-sand transition hover:bg-[#10211e]">
                Upload AWS credentials file
                <input
                  type="file"
                  accept=".txt,.ini,.csv"
                  onChange={(event) => void handleAwsCredentialsUpload(event)}
                  disabled={disabled}
                  className="sr-only"
                />
              </label>
            </div>
            {awsUploadMessage ? (
              <p className="mt-4 text-xs leading-6 text-ink/56">{awsUploadMessage}</p>
            ) : null}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <label>
              <span className={labelClassName}>AWS region</span>
              <input
                value={value.aws.region}
                onChange={updateField("aws", "region")}
                className={inputClassName}
                placeholder="eu-west-1"
              />
            </label>
            <label>
              <span className={labelClassName}>EC2 instance id</span>
              <input
                value={value.aws.instanceId}
                onChange={updateField("aws", "instanceId")}
                className={inputClassName}
                placeholder="i-0abc1234def567890"
              />
            </label>
            <label>
              <span className={labelClassName}>Docker service</span>
              <input
                value={value.aws.dockerService}
                onChange={updateField("aws", "dockerService")}
                className={inputClassName}
                placeholder="web"
              />
            </label>
          </div>
          <p className={helperClassName}>
            The worker currently uses the default 15-minute cadence and tails the
            most recent 200 log lines unless you change those defaults in code.
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
