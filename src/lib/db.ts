// @ts-expect-error — pg ships no declaration file; @types/pg is optional
import pg from "pg";
import type { QueryResult } from "./travel-types.js";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;

function getPool(): InstanceType<typeof Pool> | null {
	const connectionString: string | undefined =
		(import.meta.env as Record<string, string | undefined>).SUPABASE_DATABASE_URL ??
		process.env.SUPABASE_DATABASE_URL;

	if (!connectionString) return null;

	if (!pool) {
		pool = new Pool({
			connectionString,
			ssl: { rejectUnauthorized: false },
			min: 0,
			max: 5,
		});
	}

	return pool;
}

// ---------------------------------------------------------------------------
// Graceful shutdown — drain the pool when the process is stopping.
// Without this, idle connections leak during dev hot-reload and the
// standalone production server may hang on SIGTERM.
// ---------------------------------------------------------------------------

function shutdown() {
	if (pool) {
		pool.end().catch(() => {});
		pool = null;
	}
}

// Node.js signals — each listener is registered at most once because this
// module is only evaluated once (ESM module cache).
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
process.once("beforeExit", shutdown);

/**
 * Execute a parameterised SQL query against the Supabase PostgreSQL database.
 *
 * Returns `{ rows, error }` — never throws. If the database URL is not
 * configured the result contains an empty array and a descriptive error string.
 */
export async function query<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = [],
): Promise<QueryResult<T>> {
	const db = getPool();

	if (!db) {
		return { rows: [], error: "SUPABASE_DATABASE_URL is not configured" };
	}

	try {
		const result = await db.query(sql, params);
		return { rows: result.rows as T[], error: null };
	} catch (error) {
		return {
			rows: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
