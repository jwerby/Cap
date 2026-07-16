import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

// ─── db mock ─────────────────────────────────────────────────────────────────
// page.tsx executes four sequential db() query chains:
//   1. totalCount     — ...from(videos).leftJoin(org).where(...)           → await where
//   2. videoData      — ...from(videos).leftJoin(x4).where().groupBy()
//                          .orderBy().limit(limit).offset(offset)          → await offset
//   3. foldersData    — ...from(folders).where(...)                        → await where
//   4. orgSettings    — ...from(organizations).where(...).limit(1)         → await limit
//
// Each method returns mockDb so the fluent chain always has the next method.
// Terminal calls are configured per-test via mockReturnValueOnce so they resolve
// to the right payload when awaited.

const limitMock = vi.hoisted(() => vi.fn());
const offsetMock = vi.hoisted(() => vi.fn());

const mockDb = {
	select: vi.fn(() => mockDb),
	from: vi.fn(() => mockDb),
	leftJoin: vi.fn(() => mockDb),
	innerJoin: vi.fn(() => mockDb),
	where: vi.fn(() => mockDb),
	groupBy: vi.fn(() => mockDb),
	orderBy: vi.fn(() => mockDb),
	limit: limitMock,
	offset: offsetMock,
};

vi.mock("@cap/database", () => ({
	db: vi.fn(() => mockDb),
}));

vi.mock("@cap/database/auth/session", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@cap/database/schema", () => ({
	comments: {
		id: "comments.id",
		videoId: "comments.videoId",
		type: "comments.type",
	},
	folders: {
		id: "folders.id",
		name: "folders.name",
		color: "folders.color",
		parentId: "folders.parentId",
		organizationId: "folders.organizationId",
		createdById: "folders.createdById",
		spaceId: "folders.spaceId",
	},
	organizations: {
		id: "organizations.id",
		name: "organizations.name",
		iconUrl: "organizations.iconUrl",
		tombstoneAt: "organizations.tombstoneAt",
		settings: "organizations.settings",
	},
	sharedVideos: {
		videoId: "sharedVideos.videoId",
		organizationId: "sharedVideos.organizationId",
	},
	spaces: {
		id: "spaces.id",
		name: "spaces.name",
		organizationId: "spaces.organizationId",
		iconUrl: "spaces.iconUrl",
		password: "spaces.password",
		settings: "spaces.settings",
	},
	spaceVideos: {
		videoId: "spaceVideos.videoId",
		spaceId: "spaceVideos.spaceId",
	},
	users: { id: "users.id", name: "users.name" },
	videos: {
		id: "videos.id",
		ownerId: "videos.ownerId",
		orgId: "videos.orgId",
		name: "videos.name",
		createdAt: "videos.createdAt",
		effectiveCreatedAt: "videos.effectiveCreatedAt",
		metadata: "videos.metadata",
		source: "videos.source",
		isScreenshot: "videos.isScreenshot",
		duration: "videos.duration",
		public: "videos.public",
		folderId: "videos.folderId",
		password: "videos.password",
		settings: "videos.settings",
	},
	videoUploads: { videoId: "videoUploads.videoId" },
}));

vi.mock("@cap/env", () => ({
	serverEnv: vi.fn(() => ({
		TINYBIRD_TOKEN: undefined,
		TINYBIRD_HOST: undefined,
	})),
}));

vi.mock("@cap/web-backend", () => ({
	Database: "Database",
	ImageUploads: "ImageUploads",
	resolveEffectiveVideoRules: vi.fn(() => ({
		hasInheritedPassword: false,
		inheritedPasswordSources: [],
		inheritedSettings: {},
	})),
}));

vi.mock("@cap/web-domain", () => ({
	Video: {
		VideoId: {
			make: (id: string) => id,
		},
	},
}));

const sqlTagged = (parts: TemplateStringsArray) => ({
	sql: parts[0],
	mapWith: () => ({ sql: parts[0], mapped: true }),
});

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args: unknown[]) => ({ and: args })),
	count: vi.fn(() => ({ count: true })),
	desc: vi.fn((col: unknown) => ({ desc: col })),
	eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
	inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: [col, vals] })),
	isNull: vi.fn((col: unknown) => ({ isNull: col })),
	sql: sqlTagged,
}));

vi.mock("effect", async (importOriginal) => {
	const actual = await importOriginal<typeof import("effect")>();
	const effectPipeable = { pipe: (fn: (_v: unknown) => unknown) => fn({}) };
	const effectPipeableArray = {
		pipe: (fn: (_v: unknown) => unknown) => fn([]),
	};
	return {
		...actual,
		Effect: {
			...actual.Effect,
			all: vi.fn(() => effectPipeableArray),
			gen: vi.fn(() => effectPipeable),
			fn: vi.fn((_fn: unknown) => {
				return (..._args: unknown[]) => ({
					pipe: (pipeArg: (_v: unknown) => unknown) => pipeArg({}),
					_tag: "Effect",
				});
			}),
			map: vi.fn(),
			flatMap: vi.fn(),
			tapErrorCause: vi.fn(),
			catchTags: vi.fn(),
			logError: vi.fn(),
			exit: vi.fn(),
			fail: vi.fn(),
		},
	};
});

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`REDIRECT:${url}`);
	}),
}));

vi.mock("@/lib/server", () => ({
	runPromise: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/app/(org)/dashboard/caps/Caps", () => ({
	Caps: vi.fn(() => null),
}));

import { getCurrentUser } from "@cap/database/auth/session";
import { CAPS_PAGE_SIZE } from "@/app/(org)/dashboard/caps/caps-page-size";
import { runPromise } from "@/lib/server";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockRunPromise = runPromise as ReturnType<typeof vi.fn>;

const AUTHENTICATED_USER = {
	id: "user-abc",
	email: "officer@portstbd.com",
	activeOrganizationId: "org-xyz",
};

function resetChain() {
	mockDb.select.mockReturnValue(mockDb);
	mockDb.from.mockReturnValue(mockDb);
	mockDb.leftJoin.mockReturnValue(mockDb);
	mockDb.innerJoin.mockReturnValue(mockDb);
	mockDb.groupBy.mockReturnValue(mockDb);
	mockDb.orderBy.mockReturnValue(mockDb);

	// Chain order in page.tsx:
	//   where() call 1 (count query)    → resolves to [{count:0}]
	//   where() call 2 (video query)    → returns mockDb (chain continues)
	//   where() call 3 (folders query)  → resolves to []
	//   where() call 4 (org settings)   → returns mockDb (.limit(1) terminates)
	mockDb.where
		.mockResolvedValueOnce([{ count: 0 }] as unknown as typeof mockDb)
		.mockReturnValueOnce(mockDb)
		.mockResolvedValueOnce([] as unknown as typeof mockDb)
		.mockReturnValueOnce(mockDb);

	limitMock.mockReturnValueOnce(mockDb).mockResolvedValueOnce([]);
	offsetMock.mockResolvedValue([]);
}

// The contract: CAPS_PAGE_SIZE must be 15. Asserting the imported value here
// ensures a change to the constant fails this file immediately, rather than
// silently passing because both the test and production code read the same
// mutated constant.
describe("CAPS_PAGE_SIZE contract", () => {
	it("is exactly 15", () => {
		expect(CAPS_PAGE_SIZE).toBe(15);
	});
});

describe("CapsPage server component pagination", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetChain();
		mockGetCurrentUser.mockResolvedValue(AUTHENTICATED_USER);
		mockRunPromise.mockResolvedValue([]);
	});

	async function callCapsPage(searchParams: Record<string, string> = {}) {
		const { default: CapsPage } = await import(
			"@/app/(org)/dashboard/caps/page"
		);
		return CapsPage({
			searchParams: Promise.resolve(searchParams),
			params: Promise.resolve({}),
		} as Parameters<typeof CapsPage>[0]);
	}

	it("default path: calls db with CAPS_PAGE_SIZE limit and offset 0 when no searchParams", async () => {
		await callCapsPage({});
		expect(limitMock).toHaveBeenCalledWith(CAPS_PAGE_SIZE);
		expect(offsetMock).toHaveBeenCalledWith(0);
	});

	it("page 2: calls db with CAPS_PAGE_SIZE limit and offset CAPS_PAGE_SIZE", async () => {
		await callCapsPage({ page: "2" });
		expect(limitMock).toHaveBeenCalledWith(CAPS_PAGE_SIZE);
		expect(offsetMock).toHaveBeenCalledWith(CAPS_PAGE_SIZE);
	});

	it("page 3: calls db with CAPS_PAGE_SIZE limit and offset 2*CAPS_PAGE_SIZE", async () => {
		await callCapsPage({ page: "3" });
		expect(limitMock).toHaveBeenCalledWith(CAPS_PAGE_SIZE);
		expect(offsetMock).toHaveBeenCalledWith(2 * CAPS_PAGE_SIZE);
	});

	it("beyond last page: offset is (page-1)*CAPS_PAGE_SIZE, Caps receives empty data", async () => {
		offsetMock.mockResolvedValue([]);
		const result = await callCapsPage({ page: "999" });
		expect(offsetMock).toHaveBeenCalledWith(998 * CAPS_PAGE_SIZE);
		const element = result as React.ReactElement<{ data: unknown[] }>;
		expect(element.props.data).toEqual([]);
	});

	it("explicit limit override: respects ?limit= param over CAPS_PAGE_SIZE", async () => {
		await callCapsPage({ page: "2", limit: "10" });
		expect(limitMock).toHaveBeenCalledWith(10);
		expect(offsetMock).toHaveBeenCalledWith(10);
	});

	it("redirects to /login when user is unauthenticated", async () => {
		mockGetCurrentUser.mockResolvedValue(null);
		await expect(callCapsPage({})).rejects.toThrow("REDIRECT:/login");
	});
});
