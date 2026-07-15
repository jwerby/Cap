import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();
const revalidatePathMock = vi.hoisted(() => vi.fn());
const nanoIdMock = vi.hoisted(() => vi.fn());
const createUploadTargetForUserMock = vi.hoisted(() => vi.fn());

const mockDb = {
	select: vi.fn(() => mockDb),
	insert: vi.fn(() => mockDb),
	from: vi.fn(() => mockDb),
	where: whereMock,
	values: valuesMock,
	limit: limitMock,
};

vi.mock("@cap/database", () => ({
	db: vi.fn(() => mockDb),
}));

vi.mock("@cap/database/auth/session", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@cap/database/helpers", () => ({
	nanoId: nanoIdMock,
}));

vi.mock("@cap/database/schema", () => ({
	sharedVideos: {
		id: "sharedVideoId",
		videoId: "sharedVideoVideoId",
		organizationId: "sharedVideoOrganizationId",
		sharedByUserId: "sharedVideoSharedByUserId",
	},
	videos: {
		id: "videoId",
	},
	videoUploads: {
		videoId: "uploadVideoId",
	},
}));

vi.mock("@cap/env", () => ({
	buildEnv: { NEXT_PUBLIC_IS_CAP: false },
	NODE_ENV: "production",
	serverEnv: vi.fn(() => ({
		CAP_VIDEOS_DEFAULT_PUBLIC: true,
		PORTSTBD_AUTO_JOIN_ORG_ID: "org-1",
		WEB_URL: "https://watch.portstbd.com",
	})),
}));

vi.mock("@cap/utils", () => ({
	dub: vi.fn(() => ({
		links: {
			create: vi.fn(),
		},
	})),
	PORTSTBD_BRAND: {
		companyName: "Port & Starboard",
	},
	userIsPro: vi.fn(() => true),
}));

vi.mock("@cap/web-backend", () => ({
	Storage: {
		createUploadTargetForUser: createUploadTargetForUserMock,
	},
}));

vi.mock("@cap/web-domain", () => ({
	Video: {
		VideoId: {
			make: vi.fn((value: string) => value),
		},
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

vi.mock("@/actions/organization/authorization", () => ({
	requireOrganizationAccess: vi.fn(),
}));

vi.mock("@/lib/server", async () => {
	const { Effect } = await import("effect");
	return { runPromise: Effect.runPromise };
});

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

import { getCurrentUser } from "@cap/database/auth/session";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

describe("createVideoForServerProcessing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		nanoIdMock
			.mockReturnValueOnce("video-123")
			.mockReturnValueOnce("shared-video-123");
		valuesMock.mockResolvedValue(undefined);
		whereMock.mockReturnValue(mockDb);
		limitMock.mockResolvedValue([]);
		mockGetCurrentUser.mockResolvedValue({
			id: "user-123",
		});
		createUploadTargetForUserMock.mockReturnValue(
			Effect.succeed({
				upload: {
					type: "s3Post",
					url: "https://s3.test",
					fields: {},
				},
				bucketId: Option.some("bucket-1"),
				storageIntegrationId: Option.none(),
			}),
		);
	});

	it("shares new Port and Starboard uploads with the organization", async () => {
		const { createVideoForServerProcessing } = await import(
			"@/actions/video/create-for-processing"
		);

		await createVideoForServerProcessing({
			orgId: "org-1" as never,
		});

		expect(valuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "shared-video-123",
				videoId: "video-123",
				organizationId: "org-1",
				sharedByUserId: "user-123",
			}),
		);
	});
});
