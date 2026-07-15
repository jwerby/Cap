import { describe, expect, it } from "vitest";
import { PORTSTBD_DEFAULT_THEME, resolveTheme } from "@/app/themeScript";

describe("theme cookie resolution", () => {
	it("resolves dark cookie to dark", () => {
		expect(resolveTheme("dark")).toBe("dark");
	});

	it("resolves light cookie to light", () => {
		expect(resolveTheme("light")).toBe("light");
	});

	it("applies portstbd default when cookie is absent", () => {
		expect(resolveTheme(undefined)).toBe(PORTSTBD_DEFAULT_THEME);
	});

	it("falls back to portstbd default for unrecognised cookie values", () => {
		expect(resolveTheme("system")).toBe(PORTSTBD_DEFAULT_THEME);
		expect(resolveTheme("")).toBe(PORTSTBD_DEFAULT_THEME);
		expect(resolveTheme("auto")).toBe(PORTSTBD_DEFAULT_THEME);
	});

	it("portstbd default is light", () => {
		expect(PORTSTBD_DEFAULT_THEME).toBe("light");
	});
});
