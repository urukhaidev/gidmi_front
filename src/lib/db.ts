// @ts-expect-error — pg ships no declaration file; @types/pg is optional
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import type { QueryResult } from "./travel-types.js";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;
// Vite reloads server modules during editing. Reuse the existing pool instead
// of leaving old connections alive and opening another set on every reload.
const sharedDb = globalThis as typeof globalThis & {
	__gidmiTravelDb?: { connectionString: string; pool: InstanceType<typeof Pool> };
	__gidmiTravelDbShutdownRegistered?: boolean;
};

type CachedQueryResult = {
	expiresAt: number;
	result: QueryResult<unknown>;
};

const queryCache = new Map<string, CachedQueryResult>();
const pendingQueries = new Map<string, Promise<QueryResult<unknown>>>();
const QUERY_CACHE_TTL_MS = 120_000;
const QUERY_CACHE_MAX_ENTRIES = 300;

type BatchedRead = {
	sql: string;
	params: unknown[];
	execute: () => Promise<QueryResult<unknown>>;
	resolve: (result: QueryResult<unknown>) => void;
};
type ReadBatch = { reads: BatchedRead[]; scheduled: boolean };
const readBatches = new AsyncLocalStorage<ReadBatch>();

/**
 * Fetch independent public catalogue reads in one database round trip.
 * NUMERIC columns in these projections use ::text to retain pg's string
 * values (including decimal precision) when the rows are packed as JSON.
 */
export function withQueryBatch<T>(load: () => Promise<T>): Promise<T> {
	return readBatches.run({ reads: [], scheduled: false }, load);
}

async function flushReadBatch(batch: ReadBatch) {
	const reads = batch.reads.splice(0);
	batch.scheduled = false;
	if (reads.length === 1) {
		reads[0].resolve(await reads[0].execute());
		return;
	}
	try {
		const params: unknown[] = [];
		const columns = reads.map((read, index) => {
			const offset = params.length;
			const sql = read.sql.replace(/;\s*$/, "").replace(/\$(\d+)\b/g, (_, number) => `$${Number(number) + offset}`);
			params.push(...read.params);
			return `(select coalesce(jsonb_agg(to_jsonb(batch_row)), '[]'::jsonb)
				from (${sql}) batch_row) as q${index}`;
		});
		const db = getPool();
		if (!db) throw new Error("Database is not configured");
		const result = await db.query(`select ${columns.join(",\n")}`, params);
		reads.forEach((read, index) => read.resolve({ rows: result.rows[0][`q${index}`], error: null }));
	} catch {
		// Preserve partial results if one catalogue query fails: retry each read
		// independently, using the same error handling as an ordinary query.
		await Promise.all(reads.map(async (read) => read.resolve(await read.execute())));
	}
}

function queueRead(batch: ReadBatch, read: Omit<BatchedRead, "resolve">): Promise<QueryResult<unknown>> {
	return new Promise((resolve) => {
		batch.reads.push({ ...read, resolve });
		if (batch.scheduled) return;
		batch.scheduled = true;
		queueMicrotask(() => { void flushReadBatch(batch); });
	});
}

function getPool(): InstanceType<typeof Pool> | null {
	const connectionString: string | undefined =
		(import.meta.env as Record<string, string | undefined>).SUPABASE_DATABASE_URL ??
		process.env.SUPABASE_DATABASE_URL;

	if (!connectionString) return null;

	if (!pool) {
		if (sharedDb.__gidmiTravelDb?.connectionString === connectionString) {
			pool = sharedDb.__gidmiTravelDb.pool;
			return pool;
		}
		sharedDb.__gidmiTravelDb?.pool.end().catch(() => {});
		pool = new Pool({
			connectionString,
			ssl: { rejectUnauthorized: false },
			min: 1,
			max: import.meta.env.DEV ? 2 : 5,
			keepAlive: true,
			idleTimeoutMillis: 300_000,
		});
		sharedDb.__gidmiTravelDb = { connectionString, pool };
	}

	return pool;
}

// ---------------------------------------------------------------------------
// Graceful shutdown — drain the pool when the process is stopping.
// Without this, idle connections leak during dev hot-reload and the
// standalone production server may hang on SIGTERM.
// ---------------------------------------------------------------------------

function shutdown() {
	sharedDb.__gidmiTravelDb?.pool.end().catch(() => {});
	delete sharedDb.__gidmiTravelDb;
	pool = null;
}

// Node.js signals — each listener is registered at most once because this
// module is only evaluated once (ESM module cache).
if (!sharedDb.__gidmiTravelDbShutdownRegistered) {
	sharedDb.__gidmiTravelDbShutdownRegistered = true;
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);
	process.once("beforeExit", shutdown);
}

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

	// The local site uses the same remote catalogue as production. Keep its
	// short-lived read cache enabled in dev as well to avoid repeating network
	// round trips for navigation, city data and identical concurrent requests.
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

	const batch = readBatches.getStore();
	const request = batch && cacheable
		? queueRead(batch, { sql, params, execute }) as Promise<QueryResult<T>>
		: execute();
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
