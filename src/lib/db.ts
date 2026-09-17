// @ts-expect-error — pg ships no declaration file; @types/pg is optional
import pg from "pg";
import type { QueryResult } from "./travel-types.js";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;

type CachedQueryResult = {
	expiresAt: number;
	result: QueryResult<unknown>;
};

const queryCache = new Map<string, CachedQueryResult>();
const pendingQueries = new Map<string, Promise<QueryResult<unknown>>>();
const QUERY_CACHE_TTL_MS = 120_000;
const QUERY_CACHE_MAX_ENTRIES = 300;

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
			keepAlive: true,
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

	const cacheable = /^\s*(select|with)\b/i.test(sql);
	const cacheKey = cacheable ? `${sql}\u0000${JSON.stringify(params)}` : null;
	const now = Date.now();

	if (cacheKey) {
		const cached = queryCache.get(cacheKey);
		if (cached && cached.expiresAt > now) {
			return cached.result as QueryResult<T>;
		}

		const pending = pendingQueries.get(cacheKey);
		if (pending) return pending as Promise<QueryResult<T>>;
	}

	const execute = async (): Promise<QueryResult<T>> => {
		try {
			const result = await db.query(sql, params);
			return { rows: result.rows as T[], error: null };
		} catch (error) {
			return {
				rows: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	};

	const request = execute();
	if (cacheKey) pendingQueries.set(cacheKey, request as Promise<QueryResult<unknown>>);

	try {
		const response = await request;
		if (cacheKey && !response.error) {
			if (queryCache.size >= QUERY_CACHE_MAX_ENTRIES) {
				const oldestKey = queryCache.keys().next().value;
				if (oldestKey) queryCache.delete(oldestKey);
			}
			queryCache.set(cacheKey, {
				expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
				result: response as QueryResult<unknown>,
			});
		}
		return response;
	} finally {
		if (cacheKey) pendingQueries.delete(cacheKey);
	}
}
