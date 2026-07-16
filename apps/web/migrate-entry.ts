import { migrateDb } from "@cap/database/migrate";

process.chdir(__dirname);

if (!process.env.DATABASE_URL) {
	console.error("MIGRATION_FAILED: DATABASE_URL is not set — aborting");
	process.exit(1);
}

(async () => {
	try {
		await migrateDb();
		console.log("MIGRATION_STEP_OK");
		process.exit(0);
	} catch (error) {
		console.error("MIGRATION_FAILED", error);
		process.exit(1);
	}
})();
