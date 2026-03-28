import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { CredentialsForm } from "@/components/CredentialsForm";
import { buildDefaultDraft } from "@/lib/onboarding";

describe("CredentialsForm", () => {
  it("disables the fields until the founder is signed in", () => {
    render(
      <CredentialsForm
        value={buildDefaultDraft("Europe/Dublin")}
        disabled
        onConnectGitHub={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/repository url/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /give us access to your github repo/i })).toBeDisabled();
    expect(screen.getByText(/sign in first/i)).toBeInTheDocument();
  });

  it("propagates field changes to the parent draft", async () => {
    const user = userEvent.setup();
    const draft = buildDefaultDraft("Europe/Dublin");

    const Harness = () => {
      const [value, setValue] = useState(draft);
      return (
        <CredentialsForm
          value={value}
          disabled={false}
          onConnectGitHub={vi.fn()}
          onChange={setValue}
        />
      );
    };

    render(<Harness />);

    const repoUrlInput = screen.getByLabelText(/repository url/i);
    await user.clear(repoUrlInput);
    await user.type(repoUrlInput, "https://github.com/acme/new-hotfix-target");

    expect(repoUrlInput).toHaveValue("https://github.com/acme/new-hotfix-target");
  });

  it("calls the github connect action", async () => {
    const user = userEvent.setup();
    const onConnectGitHub = vi.fn();

    render(
      <CredentialsForm
        value={buildDefaultDraft("Europe/Dublin")}
        disabled={false}
        onConnectGitHub={onConnectGitHub}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /give us access to your github repo/i }));

    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
  });

  it("propagates AWS target field changes to the parent draft", async () => {
    const user = userEvent.setup();
    const draft = buildDefaultDraft("Europe/Dublin");

    const Harness = () => {
      const [value, setValue] = useState(draft);
      return (
        <CredentialsForm
          value={value}
          disabled={false}
          onConnectGitHub={vi.fn()}
          onChange={setValue}
        />
      );
    };

    render(<Harness />);

    const instanceIdInput = screen.getByLabelText(/ec2 instance id/i);
    await user.clear(instanceIdInput);
    await user.type(instanceIdInput, "i-0123456789abcdef0");

    expect(instanceIdInput).toHaveValue("i-0123456789abcdef0");
  });
});
