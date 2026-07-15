import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("next/navigation", () => ({
	usePathname: () => "/onboarding/organization-setup",
}));

import Stepper from "@/app/(org)/onboarding/components/Stepper";

describe("Port and Starboard onboarding", () => {
	it("shows only the core onboarding steps outside Cap deployments", () => {
		const html = renderToStaticMarkup(
			createElement(Stepper, {
				completedSteps: { welcome: true },
				capDeployment: false,
			}),
		);

		expect(html).toContain("Welcome");
		expect(html).toContain("Organization Setup");
		expect(html).toContain("Step <span");
		expect(html).toContain("2/2");
		expect(html).not.toContain("Custom Domain");
		expect(html).not.toContain("Invite your team");
		expect(html).not.toContain("Download");
	});
});
