export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type Course = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  topic: string;
  language: string;
  level: string;
  mode: 'PHYSICAL' | 'VIRTUAL' | 'SELF_PACED';
  pricePaise: number;
  originalPricePaise?: number | null;
  rating: number;
  reviewCount: number;
  durationHours: number;
  mandatoryAssessment: boolean;
  instructor: string | { name: string; bio?: string; headline?: string };
  outcomes?: string[];
  modules?: { id: string; title: string; lessons: { id: string; title: string; durationMin: number }[] }[];
  batches?: { id: string; city?: string | null; startsAt: string; endsAt: string; seatsTotal: number; seatsTaken: number }[];
  reviews?: { id: string; rating: number; comment: string; user: { name: string } }[];
};

export type CatalogResponse = {
  items: Course[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export function formatRupees(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export const languageNames: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
  bn: 'বাংলা',
};

export const modeNames: Record<Course['mode'], string> = {
  PHYSICAL: 'Classroom',
  VIRTUAL: 'Live online',
  SELF_PACED: 'Self-paced',
};
