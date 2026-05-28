import {
	buildPortstbdAssetUrl,
	getPortstbdWebUrl,
	PORTSTBD_BRAND,
} from "@cap/utils";
import { describe, expect, it } from "vitest";

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
});
