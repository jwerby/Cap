import {
	buildPortstbdAssetUrl,
	getPortstbdWebUrl,
	PORTSTBD_BRAND,
} from "@cap/utils";
import { describe, expect, it, vi } from "vitest";

describe("PORTSTBD_BRAND", () => {
	it("uses the approved public brand", () => {
		expect(PORTSTBD_BRAND.companyName).toBe("Port & Starboard");
		expect(PORTSTBD_BRAND.productName).toBe("Port & Starboard Watch");
		expect(PORTSTBD_BRAND.domain).toBe("watch.portstbd.com");
		expect(PORTSTBD_BRAND.colors.atlanticBlue).toBe("#163760");
	});

	it("falls back to the approved production URL", () => {
		expect(getPortstbdWebUrl({})).toBe("https://watch.portstbd.com");
	});

	it("falls back when runtime URL values are blank", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "  ",
				WEB_URL: "\t",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("skips blank public URL values before checking server URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "  ",
				WEB_URL: "watch.portstbd.com",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("normalizes bare host runtime URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "watch.portstbd.com",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("uses the default URL when process is unavailable", () => {
		const originalProcess = globalThis.process;

		vi.stubGlobal("process", undefined);

		try {
			expect(getPortstbdWebUrl()).toBe("https://watch.portstbd.com");
		} finally {
			vi.stubGlobal("process", originalProcess);
		}
	});

	it("prefers runtime public URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "https://staging-watch.portstbd.com",
			}),
		).toBe("https://staging-watch.portstbd.com");
		expect(getPortstbdWebUrl({ WEB_URL: "https://watch.portstbd.com" })).toBe(
			"https://watch.portstbd.com",
		);
	});

	it("builds absolute asset URLs from the runtime public URL", () => {
		expect(
			buildPortstbdAssetUrl("/port-starboard-logo-email.png", {
				NEXT_PUBLIC_WEB_URL: "https://staging-watch.portstbd.com",
			}),
		).toBe("https://staging-watch.portstbd.com/port-starboard-logo-email.png");
	});

	it("rejects protocol-relative asset paths", () => {
		expect(() =>
			buildPortstbdAssetUrl("//evil.example/x" as `/${string}`, {}),
		).toThrow("Asset path must not be protocol-relative");
	});
});
