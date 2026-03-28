import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DemoAuthPanel } from "@/components/DemoAuthPanel";

describe("DemoAuthPanel", () => {
  it("starts the demo sign-in flow when signed out", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();

    render(<DemoAuthPanel user={null} onSignIn={onSignIn} onSignOut={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows the current founder session and allows reset", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    const loggedInUser = {
      name: "Launch Founder",
      fullName: "Launch Founder",
      email: "founder@vibefix.demo",
      company: "Weekend Ship Co.",
    };

    render(
      <DemoAuthPanel user={loggedInUser} onSignIn={vi.fn()} onSignOut={onSignOut} />
    );

    expect(
      screen.getByText((content) => content.includes(loggedInUser.email))
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset demo session/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
