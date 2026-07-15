import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readWebSource = (relativePath: string) =>
	readFile(path.join(process.cwd(), relativePath), "utf8");

describe("Port and Starboard dashboard dark mode", () => {
	it("keeps dark theme overrides on the branded dashboard shell", async () => {
		const sources = await Promise.all([
			readWebSource("app/(org)/dashboard/layout.tsx"),
			readWebSource("app/(org)/dashboard/_components/DashboardInner.tsx"),
			readWebSource("app/(org)/dashboard/_components/Navbar/Top.tsx"),
			readWebSource("app/(org)/dashboard/_components/Navbar/Mobile.tsx"),
			readWebSource("app/(org)/dashboard/_components/Navbar/Items.tsx"),
			readWebSource("app/(org)/dashboard/_components/Navbar/CapAIBox.tsx"),
		]);

		for (const source of sources) {
			expect(source).toContain("dark:bg-gray-");
			expect(source).toContain("dark:text-gray-");
		}
	});
});
