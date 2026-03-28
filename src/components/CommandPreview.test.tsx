import { render, screen } from "@testing-library/react";

import { CommandPreview } from "@/components/CommandPreview";
import { buildDefaultDraft } from "@/lib/onboarding";

describe("CommandPreview", () => {
  it("renders the SSM probe and product note for the demo flow", () => {
    const draft = buildDefaultDraft("Europe/Dublin");

    render(<CommandPreview value={draft} />);

    expect(screen.getByText(/aws ssm send-command/i)).toBeInTheDocument();
    expect(screen.getByText(/daytona only sees the log excerpt/i)).toBeInTheDocument();
  });
});
