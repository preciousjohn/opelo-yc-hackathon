export interface BusinessOffering {
  name: string;
  priceCents: number;
}

export interface BusinessProfile {
  name: string;
  website: string;
  ownerName: string;
  managerName: string;
  phone: string;
  offerings: BusinessOffering[];
}

export const demoBusiness: BusinessProfile = {
  name: "nood coffee",
  website: process.env.BUSINESS_WEBSITE || "noodcoffeeca.com",
  ownerName: process.env.BUSINESS_OWNER_NAME || "Hanadi",
  managerName: "Opelo",
  phone: process.env.OWNER_PHONE_NUMBER || "+15555550123",
  offerings: [
    { name: "Half Day (up to 4 hrs, up to 75 guests)", priceCents: 80000 },
    { name: "Full Day (up to 8 hrs, unlimited guests)", priceCents: 140000 },
    { name: "Custom Event Package", priceCents: 120000 },
  ],
};

export function businessSignature(
  channel: "email" | "sms" | "social_dm" | "phone_transcript",
) {
  const name = process.env.BUSINESS_OWNER_NAME || demoBusiness.ownerName;
  const title = process.env.BUSINESS_OWNER_TITLE || "Founder";

  if (channel === "email") {
    return `Best,\n${name}\n${title}`;
  }

  return `— ${name}, ${title}`;
}

export const DEFAULT_MANAGER_NAME = "Opelo";
