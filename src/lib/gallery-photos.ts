function imageKey(src: string) {
	// Tripster can serve the same original through different resize URLs.
	return src.match(/https?:\/\/cdn\.tripster\.ru\/[^?#\s]+/)?.[0] ?? src.trim();
}

export function uniqueGalleryPhotos<T extends { image_url: string | null }>(photos: T[], cover?: string | null): T[] {
	const seen = new Set<string>(cover ? [imageKey(cover)] : []);
	return photos.filter((photo) => {
		if (!photo.image_url) return false;
		const key = imageKey(photo.image_url);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
