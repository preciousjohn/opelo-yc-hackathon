export interface BusinessOffering {
  name: string;
  priceCents: number;
}

export interface BusinessProfile {
  name: string;
  ownerName: string;
  managerName: string;
  phone: string;
  offerings: BusinessOffering[];
}

export const demoBusiness: BusinessProfile = {
  name: "Opelo Demo Studio",
  ownerName: process.env.BUSINESS_OWNER_NAME || "Raina",
  managerName: "Opelo",
  phone: process.env.OWNER_PHONE_NUMBER || "+15555550123",
  offerings: [
    { name: "Creator Course", priceCents: 8200 },
    { name: "Consulting Package", priceCents: 300000 },
    { name: "AI Workflow Implementation", priceCents: 800000 },
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
