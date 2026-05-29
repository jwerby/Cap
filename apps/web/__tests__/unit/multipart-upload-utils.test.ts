import { describe, expect, it } from "vitest";
import {
	buildMultipartRemuxJobBody,
	getMultipartFileKey,
	getMultipartPreviewAssetKeys,
	getSubpath,
	isRawRecorderUpload,
} from "@/app/api/upload/[...route]/multipart-utils";

describe("multipart upload utils", () => {
	it("builds a multipart file key from video id and subpath", () => {
		expect(
			getMultipartFileKey("user-123", {
				videoId: "video-456",
				subpath: "raw-upload.webm",
			}),
		).toBe("user-123/video-456/raw-upload.webm");
	});

	it("defaults the multipart subpath to result.mp4", () => {
		const input: { subpath?: string } = {};

		expect(
			getMultipartFileKey("user-123", {
				videoId: "video-456",
			}),
		).toBe("user-123/video-456/result.mp4");
		expect(getSubpath(input)).toBe("result.mp4");
	});

	it("parses deprecated fileKey input into the current user-scoped key", () => {
		expect(
			getMultipartFileKey("user-123", {
				fileKey: "legacy-owner/video-456/raw-upload.webm",
			}),
		).toBe("user-123/video-456/raw-upload.webm");
		expect(
			getSubpath({
				fileKey: "legacy-owner/video-456/raw-upload.webm",
			}),
		).toBeUndefined();
	});

	it("detects raw recorder uploads", () => {
		expect(isRawRecorderUpload("raw-upload.webm")).toBe(true);
		expect(isRawRecorderUpload("raw-upload.mp4")).toBe(true);
		expect(isRawRecorderUpload("result.mp4")).toBe(false);
	});

	it("builds remux preview asset keys and thumbnail upload payload", () => {
		expect(getMultipartPreviewAssetKeys("user-123", "video-456")).toEqual({
			thumbnailKey: "user-123/video-456/screenshot/screen-capture.jpg",
			previewGifKey: "user-123/video-456/preview/animated-preview.gif",
		});

		expect(
			buildMultipartRemuxJobBody({
				videoId: "video-456",
				userId: "user-123",
				videoUrl: "https://storage.example/input.mp4",
				outputPresignedUrl: "https://storage.example/output.mp4",
				thumbnailPresignedUrl: "https://storage.example/thumbnail.jpg",
				previewGifPresignedUrl: "https://storage.example/preview.gif",
				webhookUrl: "https://watch.example/api/webhooks/media-server/progress",
				webhookSecret: "test-secret",
				inputExtension: ".mp4",
			}),
		).toEqual({
			videoId: "video-456",
			userId: "user-123",
			videoUrl: "https://storage.example/input.mp4",
			outputPresignedUrl: "https://storage.example/output.mp4",
			thumbnailPresignedUrl: "https://storage.example/thumbnail.jpg",
			previewGifPresignedUrl: "https://storage.example/preview.gif",
			webhookUrl: "https://watch.example/api/webhooks/media-server/progress",
			webhookSecret: "test-secret",
			inputExtension: ".mp4",
			remuxOnly: true,
		});
	});

	it("rejects missing video ids", () => {
		expect(() =>
			getMultipartFileKey("user-123", {
				subpath: "raw-upload.webm",
			}),
		).toThrow("Video id not found");
	});
});
