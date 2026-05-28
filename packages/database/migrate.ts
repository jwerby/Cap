import path from "node:path";
import { db } from "@cap/database";
import { DrizzleQueryError } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";

import { runOrgIdBackfill } from "./migrations/orgid_backfill.ts";
import { runSpaceMemberRoleBackfill } from "./migrations/space_member_role_backfill.ts";

async function runMigrate() {
	await migrate(db(), {
		migrationsFolder: path.join(process.cwd(), "/migrations"),
	});
}

function errorIsOrgIdMigration(e: unknown): e is DrizzleQueryError {
	return (
		e instanceof DrizzleQueryError &&
		e.query ===
			"ALTER TABLE `videos` MODIFY COLUMN `orgId` varchar(15) NOT NULL;"
	);
}

// A schema that already exists but whose drizzle bookkeeping table is missing
// makes the migrator replay from 0000 and throw "already exists" (MySQL errno
// 1050 / sqlState 42S01). Treat that as benign so boot does not crash-loop;
// the schema is already present and the journal self-heals on the next migrate.
function errorIsAlreadyApplied(e: unknown): boolean {
	const cause = e instanceof DrizzleQueryError ? e.cause : e;
	const code = (cause as { code?: string } | undefined)?.code;
	const errno = (cause as { errno?: number } | undefined)?.errno;
	return code === "ER_TABLE_EXISTS_ERROR" || errno === 1050;
}

export async function migrateDb() {
	try {
		await runMigrate();
	} catch (e) {
		if (errorIsAlreadyApplied(e)) {
			console.warn(
				"migrate: schema already present but drizzle journal missing; skipping replay",
			);
			await runSpaceMemberRoleBackfill();
			return;
		}

		if (!errorIsOrgIdMigration(e)) throw e;

		console.log("non-null videos.orgId migration failed, running backfill");

		await runOrgIdBackfill();

		try {
			await runMigrate();
		} catch (retryError) {
			if (errorIsOrgIdMigration(retryError)) {
				throw new Error(
					"videos.orgId backfill failed, you will need to manually update the videos.orgId column before attempting to migrate again.",
				);
			}
			throw retryError;
		}
	}

	await runSpaceMemberRoleBackfill();
}
