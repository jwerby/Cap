import { resolveCloudFrontConfig } from "@cap/web-backend";
import { describe, expect, it } from "vitest";

const privateKey =
	"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";

describe("resolveCloudFrontConfig", () => {
	it("disables CloudFront when no config is present", () => {
		expect(resolveCloudFrontConfig({})).toEqual({ _tag: "disabled" });
	});

	it("rejects partial CloudFront config", () => {
		expect(
			resolveCloudFrontConfig({
				bucketUrl: "https://cdn.example.com",
				distributionId: "E123",
			}),
		).toEqual({
			_tag: "invalid",
			message:
				"Incomplete CloudFront config. Missing CLOUDFRONT_KEYPAIR_ID, CLOUDFRONT_KEYPAIR_PRIVATE_KEY.",
		});
	});

	it("rejects non-HTTPS bucket URLs", () => {
		expect(
			resolveCloudFrontConfig({
				bucketUrl: "http://cdn.example.com",
				distributionId: "E123",
				keypairId: "K123",
				privateKey,
			}),
		).toEqual({
			_tag: "invalid",
			message: "CAP_AWS_BUCKET_URL must use https.",
		});
	});

	it("normalizes valid CloudFront config", () => {
		expect(
			resolveCloudFrontConfig({
				bucketUrl: "https://cdn.example.com/",
				distributionId: " E123 ",
				keypairId: " K123 ",
				privateKey,
			}),
		).toEqual({
			_tag: "enabled",
			config: {
				bucketUrl: "https://cdn.example.com",
				distributionId: "E123",
				keypairId: "K123",
				privateKey:
					"-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
			},
		});
	});
});
