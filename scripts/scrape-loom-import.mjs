#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const GRAPHQL_URL = "https://www.loom.com/graphql";
const DEFAULT_EMAIL = "alexandra@portstbd.com";
const ROOT_FOLDER_NAMES = new Set(["my videos"]);

function parseArgs(argv) {
	const args = {
		cookieJar: process.env.LOOM_COOKIE_JAR,
		email: process.env.LOOM_IMPORT_EMAIL ?? DEFAULT_EMAIL,
		csv: "loom-import.csv",
		details: "loom-import-details.json",
	};

	for (let index = 2; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--cookie-jar") {
			args.cookieJar = next;
			index += 1;
		} else if (arg === "--email") {
			args.email = next;
			index += 1;
		} else if (arg === "--csv") {
			args.csv = next;
			index += 1;
		} else if (arg === "--details") {
			args.details = next;
			index += 1;
		}
	}

	if (!args.cookieJar) {
		throw new Error("Missing --cookie-jar or LOOM_COOKIE_JAR");
	}

	return args;
}

async function readCookieHeader(cookieJarPath) {
	const text = await fs.readFile(cookieJarPath, "utf8");
	const cookies = [];

	for (const line of text.split(/\r?\n/)) {
		if (!line || line.startsWith("#")) continue;
		const parts = line.split("\t");
		if (parts.length < 7) continue;
		const [domain, , cookiePath, , expires, name, value] = parts;
		if (!domain.includes("loom.com")) continue;
		if (Number(expires) > 0 && Number(expires) < Date.now() / 1000) continue;
		if (!cookiePath.startsWith("/")) continue;
		cookies.push(`${name}=${value}`);
	}

	if (cookies.length === 0) {
		throw new Error(`No loom.com cookies found in ${cookieJarPath}`);
	}

	return cookies.join("; ");
}

async function graphql(cookieHeader, body) {
	const response = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://www.loom.com",
			referer: "https://www.loom.com/looms/videos",
			cookie: cookieHeader,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(`Loom GraphQL HTTP ${response.status}`);
	}

	const data = await response.json();
	if (data.errors?.length) {
		throw new Error(data.errors.map((error) => error.message).join("; "));
	}

	return data.data;
}

const selectedWorkspaceQuery = `query SelectedWorkspaceMembership {
  selectedWorkspaceMembership {
    ... on SelectedWorkspaceMembershipResponsePayload {
      workspaceMembership {
        id
        member_role
        organization {
          id
          name
          counts {
            videos
            folders
          }
        }
      }
    }
  }
}`;

const getLoomsQuery = `query GetLooms(
  $limit: Int!,
  $cursor: String,
  $folderId: String,
  $sourceValue: String,
  $source: LoomsSource!,
  $sortType: LoomsSortType!,
  $sortOrder: LoomsSortOrder!,
  $sortGrouping: LoomsSortGrouping,
  $filters: [[LoomsCollectionFilter!]!],
  $timeRange: TimeRange
) {
  getLooms {
    __typename
    ... on GetLoomsPayload {
      videos(
        first: $limit,
        after: $cursor,
        folderId: $folderId,
        sourceValue: $sourceValue,
        source: $source,
        sortType: $sortType,
        sortOrder: $sortOrder,
        sortGrouping: $sortGrouping,
        filters: $filters,
        timeRange: $timeRange
      ) {
        edges {
          cursor
          node {
            id
            name
            folder_id
            folder { id name }
            spaceFolders { id name }
            current_user_is_owner
          }
          profileSort
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
}`;

async function scrapeLooms(cookieHeader) {
	const videos = [];
	let cursor = null;
	let page = 0;

	while (true) {
		page += 1;
		const data = await graphql(cookieHeader, {
			operationName: "GetLooms",
			variables: {
				limit: 99,
				cursor,
				folderId: null,
				sourceValue: null,
				source: "ALL",
				sortType: "RECENT",
				sortOrder: "DESC",
				sortGrouping: null,
				filters: [],
				timeRange: null,
			},
			query: getLoomsQuery,
		});

		const payload = data.getLooms;
		if (payload?.__typename !== "GetLoomsPayload") {
			throw new Error(`Unexpected getLooms payload: ${payload?.__typename}`);
		}

		const connection = payload.videos;
		for (const edge of connection.edges ?? []) {
			if (!edge?.node?.id) continue;
			videos.push({
				...edge.node,
				cursor: edge.cursor,
				profileSort: edge.profileSort,
			});
		}

		console.error(`Fetched page ${page}: ${videos.length} videos`);
		if (!connection.pageInfo?.hasNextPage) break;
		cursor = connection.pageInfo.endCursor;
	}

	return videos;
}

function deriveSpaceName(video) {
	const spaceFolderName = video.spaceFolders?.[0]?.name?.trim();
	if (spaceFolderName) return spaceFolderName;

	const folderName = video.folder?.name?.trim();
	if (!folderName) return "";
	if (ROOT_FOLDER_NAMES.has(folderName.toLowerCase())) return "";
	return folderName;
}

function csvEscape(value) {
	const stringValue = String(value ?? "");
	if (!/[",\r\n]/.test(stringValue)) return stringValue;
	return `"${stringValue.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
	return `${[
		["loomUrl", "userEmail", "spaceName"],
		...rows.map((row) => [row.loomUrl, row.userEmail, row.spaceName]),
	]
		.map((row) => row.map(csvEscape).join(","))
		.join("\n")}\n`;
}

async function main() {
	const args = parseArgs(process.argv);
	const cookieHeader = await readCookieHeader(args.cookieJar);
	const workspace = await graphql(cookieHeader, {
		operationName: "SelectedWorkspaceMembership",
		variables: {},
		query: selectedWorkspaceQuery,
	});
	const videos = await scrapeLooms(cookieHeader);

	const details = videos.map((video) => ({
		id: video.id,
		url: `https://www.loom.com/share/${video.id}`,
		title: video.name,
		folderId: video.folder_id ?? video.folder?.id ?? null,
		folderName: video.folder?.name ?? null,
		spaceFolders: video.spaceFolders ?? [],
		spaceName: deriveSpaceName(video),
		current_user_is_owner: video.current_user_is_owner,
		cursor: video.cursor,
		profileSort: video.profileSort,
	}));

	const rows = details.map((detail) => ({
		loomUrl: detail.url,
		userEmail: args.email,
		spaceName: detail.spaceName,
	}));

	await fs.writeFile(args.csv, toCsv(rows), "utf8");
	await fs.writeFile(
		args.details,
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				workspace:
					workspace.selectedWorkspaceMembership?.workspaceMembership ?? null,
				count: details.length,
				uniqueFolders: Array.from(
					new Map(
						details
							.filter((detail) => detail.folderId)
							.map((detail) => [detail.folderId, detail.folderName]),
					).entries(),
				).map(([id, name]) => ({ id, name })),
				uniqueSpaceNames: [
					...new Set(details.map((detail) => detail.spaceName).filter(Boolean)),
				].sort(),
				items: details,
			},
			null,
			2,
		),
		"utf8",
	);

	console.log(`Wrote ${rows.length} rows to ${path.resolve(args.csv)}`);
	console.log(`Wrote details to ${path.resolve(args.details)}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
