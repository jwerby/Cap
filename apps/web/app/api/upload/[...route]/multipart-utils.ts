import { parseVideoIdOrFileKey } from "../utils";

export const getSubpath = (input: { subpath?: string; fileKey?: string }) => {
	if ("fileKey" in input) {
		return undefined;
	}

	return input.subpath ?? "result.mp4";
};

export const getMultipartFileKey = (
	userId: string,
	input:
		| { videoId?: string; subpath?: string }
		| {
				fileKey?: string;
		  },
) => {
	if ("fileKey" in input && input.fileKey) {
		return parseVideoIdOrFileKey(userId, { fileKey: input.fileKey });
	}

	if (!("videoId" in input) || !input.videoId) {
		throw new Error("Video id not found");
	}

	return parseVideoIdOrFileKey(userId, {
		videoId: input.videoId,
		subpath: input.subpath ?? "result.mp4",
	});
};

export const isRawRecorderUpload = (subpath: string) =>
	subpath.startsWith("raw-upload.");

export type MultipartRemuxJobInput = {
	videoId: string;
	userId: string;
	videoUrl: string;
	outputPresignedUrl: string;
	thumbnailPresignedUrl: string;
	previewGifPresignedUrl: string;
	webhookUrl?: string;
	webhookSecret?: string;
	inputExtension?: string;
};

export const getMultipartPreviewAssetKeys = (
	userId: string,
	videoId: string,
) => ({
	thumbnailKey: `${userId}/${videoId}/screenshot/screen-capture.jpg`,
	previewGifKey: `${userId}/${videoId}/preview/animated-preview.gif`,
});

export const buildMultipartRemuxJobBody = (input: MultipartRemuxJobInput) => ({
	...input,
	remuxOnly: true,
});
