import { render, screen } from "@testing-library/react";

import { CommandPreview } from "@/components/CommandPreview";
import { buildDefaultDraft } from "@/lib/onboarding";

describe("CommandPreview", () => {
  it("renders the SSH probe and product note for the demo flow", () => {
    const draft = buildDefaultDraft("Europe/Dublin");

    render(<CommandPreview value={draft} />);

    expect(screen.getByText(/ssh -p 22 ubuntu@ec2-12-34-56-78\.compute\.amazonaws\.com/i)).toBeInTheDocument();
    expect(screen.queryByText(/skip AWS keys/i)).not.toBeInTheDocument();
    expect(screen.getByText(/direct SSH into EC2 only needs/i)).toBeInTheDocument();
  });
});
