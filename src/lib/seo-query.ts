import { query } from "./db.js";
import type { QueryResult, SeoBlockRow } from "./travel-types.js";

export type SeoEntityType = SeoBlockRow["entity_type"];

export async function getSeoBlock(
	entityType: SeoEntityType,
	entityId: string | number | null | undefined,
): Promise<QueryResult<SeoBlockRow>> {
	if (!entityId) {
		return { rows: [], error: null };
	}

	return query<SeoBlockRow>(
		`
		select
			entity_type,
			entity_id,
			h1,
			title,
			h2,
			body,
			faq
		from seo_blocks
		where entity_type = $1
			and entity_id = $2
			and is_active = true
		limit 1
		`,
		[entityType, String(entityId)],
	);
}
