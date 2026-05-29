import { beforeEach, describe, expect, it, vi } from "vitest";

const updateWhereMock = vi.fn();
const selectWhereMock = vi.fn();
const fetchMock = vi.fn();
const runPromiseMock = vi.fn();

const effectValue = <T>(value: T) => ({
	pipe: (fn: (value: T) => unknown) => fn(value),
});

const bucketMock = {
	getInternalSignedObjectUrl: vi.fn(() =>
		effectValue("https://storage.example/raw-upload.webm"),
	),
	getInternalPresignedPutUrl: vi.fn((key: string) =>
		effectValue(`https://storage.example/${key}`),
	),
};

const dbMock = vi.fn(() => ({
	update: vi.fn(() => ({
		set: vi.fn(() => ({
			where: updateWhereMock,
		})),
	})),
	select: vi.fn(() => ({
		from: vi.fn(() => ({
			where: selectWhereMock,
		})),
	})),
}));

vi.mock("@cap/database", () => ({
	db: dbMock,
}));

vi.mock("server-only", () => ({}));

vi.mock("@cap/env", () => ({
	serverEnv: () => ({
		MEDIA_SERVER_URL: "https://media.example",
		MEDIA_SERVER_WEBHOOK_URL: "https://watch.example",
		MEDIA_SERVER_WEBHOOK_SECRET: "test-media-secret",
		WEB_URL: "https://watch.example",
	}),
}));

vi.mock("@cap/web-backend", () => ({
	Storage: {
		getAccessForVideo: vi.fn(() => effectValue([bucketMock, null])),
	},
}));

vi.mock("@/lib/server", () => ({
	runPromise: runPromiseMock,
}));

vi.mock("@/lib/video-storage", () => ({
	decodeStorageVideo: vi.fn((video) => video),
}));

describe("video processing starts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = fetchMock;
		runPromiseMock.mockImplementation(async (value) => value);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ jobId: "job-123" }),
			text: async () => JSON.stringify({ jobId: "job-123" }),
		});
	});

	it("does not start a duplicate workflow when processing is already running", async () => {
		updateWhereMock.mockResolvedValueOnce({ affectedRows: 0 });
		selectWhereMock.mockResolvedValueOnce([
			{
				videoId: "video-123",
				phase: "processing",
				rawFileKey: "user-123/video-123/raw-upload.webm",
			},
		]);

		const { startVideoProcessingWorkflow } = await import(
			"@/lib/video-processing"
		);

		await expect(
			startVideoProcessingWorkflow({
				videoId: "video-123" as never,
				userId: "user-123",
				rawFileKey: "user-123/video-123/raw-upload.webm",
				bucketId: null,
				processingMessage: "Starting video processing...",
				startFailureMessage: "Video processing could not start.",
			}),
		).resolves.toBe("already-processing");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("queues media server processing after claiming the upload row", async () => {
		updateWhereMock.mockResolvedValueOnce({ affectedRows: 1 });
		selectWhereMock.mockResolvedValueOnce([
			{
				id: "video-123",
				ownerId: "user-123",
				source: { type: "webMP4" },
				bucket: null,
				storageIntegrationId: null,
			},
		]);

		const { startVideoProcessingWorkflow } = await import(
			"@/lib/video-processing"
		);

		await expect(
			startVideoProcessingWorkflow({
				videoId: "video-123" as never,
				userId: "user-123",
				rawFileKey: "user-123/video-123/raw-upload.webm",
				bucketId: null,
				processingMessage: "Starting video processing...",
				startFailureMessage: "Video processing could not start.",
				mode: "multipart",
			}),
		).resolves.toBe("started");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://media.example/video/process",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-media-server-secret": "test-media-secret",
				},
			}),
		);

		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		if (!requestInit || typeof requestInit.body !== "string") {
			throw new Error("Expected media server request body");
		}
		const body = JSON.parse(requestInit.body);
		expect(body).toMatchObject({
			videoId: "video-123",
			userId: "user-123",
			videoUrl: "https://storage.example/raw-upload.webm",
			outputPresignedUrl:
				"https://storage.example/user-123/video-123/result.mp4",
			thumbnailPresignedUrl:
				"https://storage.example/user-123/video-123/screenshot/screen-capture.jpg",
			previewGifPresignedUrl:
				"https://storage.example/user-123/video-123/preview/animated-preview.gif",
			webhookUrl:
				"https://watch.example/api/webhooks/media-server/progress?retryable=true",
			webhookSecret: "test-media-secret",
			inputExtension: ".webm",
		});
	});

	it("queues media server processing when mysql returns affectedRows in the first tuple slot", async () => {
		updateWhereMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
		selectWhereMock.mockResolvedValueOnce([
			{
				id: "video-123",
				ownerId: "user-123",
				source: { type: "webMP4" },
				bucket: null,
				storageIntegrationId: null,
			},
		]);

		const { startVideoProcessingWorkflow } = await import(
			"@/lib/video-processing"
		);

		await expect(
			startVideoProcessingWorkflow({
				videoId: "video-123" as never,
				userId: "user-123",
				rawFileKey: "user-123/video-123/raw-upload.webm",
				bucketId: null,
				processingMessage: "Starting video processing...",
				startFailureMessage: "Video processing could not start.",
				mode: "multipart",
			}),
		).resolves.toBe("started");

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("force restarts a stale processing row", async () => {
		updateWhereMock.mockResolvedValueOnce({ affectedRows: 1 });
		selectWhereMock.mockResolvedValueOnce([
			{
				id: "video-123",
				ownerId: "user-123",
				source: { type: "webMP4" },
				bucket: null,
				storageIntegrationId: null,
			},
		]);

		const { startVideoProcessingWorkflow } = await import(
			"@/lib/video-processing"
		);

		await expect(
			startVideoProcessingWorkflow({
				videoId: "video-123" as never,
				userId: "user-123",
				rawFileKey: "user-123/video-123/raw-upload.webm",
				bucketId: null,
				processingMessage: "Retrying video processing...",
				startFailureMessage: "Video processing could not restart.",
				forceRestart: true,
			}),
		).resolves.toBe("started");

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("marks the upload as errored when media server queueing fails", async () => {
		updateWhereMock
			.mockResolvedValueOnce({ affectedRows: 1 })
			.mockResolvedValueOnce({ affectedRows: 1 });
		selectWhereMock.mockResolvedValueOnce([
			{
				id: "video-123",
				ownerId: "user-123",
				source: { type: "webMP4" },
				bucket: null,
				storageIntegrationId: null,
			},
		]);
		fetchMock.mockRejectedValueOnce(new Error("temporary failure"));

		const { startVideoProcessingWorkflow } = await import(
			"@/lib/video-processing"
		);

		await expect(
			startVideoProcessingWorkflow({
				videoId: "video-123" as never,
				userId: "user-123",
				rawFileKey: "user-123/video-123/raw-upload.webm",
				bucketId: null,
				processingMessage: "Starting video processing...",
				startFailureMessage: "Video processing could not start.",
			}),
		).rejects.toThrow("temporary failure");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(updateWhereMock).toHaveBeenCalledTimes(2);
	});
});
