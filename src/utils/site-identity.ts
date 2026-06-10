/** Resolved media reference from getSiteSettings() */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface StarterSiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
	favicon?: MediaReference;
}

const DEFAULT_SITE_TITLE = "Гидми";
const DEFAULT_SITE_TAGLINE = "Экскурсии, города и маршруты для путешествий.";

export function resolveStarterSiteIdentity(settings?: StarterSiteIdentitySettings) {
	const configuredTitle = settings?.title?.trim();
	const configuredTagline = settings?.tagline?.trim();

	return {
		siteTitle:
			!configuredTitle || configuredTitle === "My Site" || configuredTitle === "Экскурсии"
				? DEFAULT_SITE_TITLE
				: configuredTitle,
		siteTagline:
			!configuredTagline || configuredTagline === "Built with EmDash"
				? DEFAULT_SITE_TAGLINE
				: configuredTagline,
		siteLogo: settings?.logo?.url ? settings.logo : null,
	};
}
