export interface ExtractedEventDetails {
  date?: string;
  guestCount?: number;
  drinkNotes?: string;
  address?: string;
}

export function extractEventDetails(text: string): ExtractedEventDetails {
  const lower = text.toLowerCase();
  const out: ExtractedEventDetails = {};

  const monthDate =
    text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?/i,
    )?.[0] ??
    text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0];
  if (monthDate) out.date = monthDate.replace(/\s+/g, " ").trim();

  const guestMatch =
    text.match(/(?:around|about|~|approximately)?\s*(\d{1,4})\s*(?:guests|people|attendees|families)/i) ??
    text.match(/(\d{1,4})\s*(?:guests|people)\b/i);
  if (guestMatch) {
    const n = parseInt(guestMatch[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 5000) out.guestCount = n;
  }

  const drinkTerms = [
    "oat milk",
    "lavender",
    "latte",
    "espresso",
    "decaf",
    "almond milk",
    "custom drink",
  ];
  const drinks = drinkTerms.filter((t) => lower.includes(t));
  if (drinks.length) out.drinkNotes = drinks.join(", ");

  const addressMatch = text.match(
    /\b\d{1,5}\s+[\w\s]+(?:st|street|ave|avenue|rd|road|blvd|drive|way|ln|lane)[^.\n]*/i,
  );
  if (addressMatch) out.address = addressMatch[0].trim();

  return out;
}
