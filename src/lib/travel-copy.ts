const formatCount = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString("ru-RU");

const pluralRu = (count: number, one: string, few: string, many: string) => {
	const mod10 = count % 10;
	const mod100 = count % 100;

	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
};

const formatMoney = (value: number | string | null | undefined, currency: string | null | undefined) => {
	const price = Number(value ?? 0);
	const code = String(currency ?? "RUB").trim() || "RUB";

	if (!price || Number.isNaN(price)) return null;

	try {
		return new Intl.NumberFormat("ru-RU", {
			style: "currency",
			currency: code,
			maximumFractionDigits: 0,
		}).format(price);
	} catch {
		return `${price.toLocaleString("ru-RU")} ${code}`;
	}
};

const formatUpcomingMonths = (date = new Date()) => {
	const months = Array.from({ length: 3 }, (_, index) => {
		const monthDate = new Date(date.getFullYear(), date.getMonth() + index, 1);
		return {
			month: new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(monthDate),
			year: monthDate.getFullYear(),
		};
	});
	const sameYear = months.every((item) => item.year === months[0].year);

	if (sameYear) {
		return `${months[0].month}, ${months[1].month} и ${months[2].month} ${months[0].year} г.`;
	}

	return `${months[0].month} ${months[0].year} г., ${months[1].month} и ${months[2].month} ${months[2].year} г.`;
};

export function excursionHeroLead({
	count,
	placePhrase,
	minPriceValue,
	minPriceCurrency,
	guidesCount,
}: {
	count: number | string | null | undefined;
	placePhrase: string;
	minPriceValue?: number | string | null;
	minPriceCurrency?: string | null;
	guidesCount?: number | string | null;
}) {
	const numericCount = Number(count ?? 0);
	const numericGuidesCount = Number(guidesCount ?? 0);
	const price = formatMoney(minPriceValue, minPriceCurrency);
	const priceText = price ? `, цены от ${price}` : "";
	const experienceLabel = pluralRu(numericCount, "экскурсия", "экскурсии", "экскурсий");
	const guidesText = numericGuidesCount > 0
		? ` и ${formatCount(guidesCount)} ${pluralRu(numericGuidesCount, "гид", "гида", "гидов")}`
		: "";

	return `Найдено ${formatCount(count)} ${experienceLabel}${guidesText} ${placePhrase} на русском языке${priceText}. Расписание для бронирования на ${formatUpcomingMonths()}`;
}
