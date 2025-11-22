export interface Venue {
  id: string;
  name: string;
}

export interface Booking {
  venueId: string;
  date: string;
  timeSlot: string;
  department: string;
  status: string; // "Paid", "Pending", etc.
  booker: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: Booking[];
  error?: string;
}

export interface DepartmentStats {
  department: string;
  totalHours: number;
  frontSlots: number; // 18:00-20:00
  backSlots: number; // 20:00-22:00
  fullBlocks: number; // Contiguous 18:00-22:00 on same court
}

export interface SwapSuggestion {
  type: 'SWAP_SLOTS' | 'GIVE_SLOT';
  fromDept: string;
  toDept: string;
  description: string;
  benefit: string; // Why this swap is good
  date: string; // YYYY-MM-DD
  fromSlots: string[]; // e.g. ["排球場1 18:00-20:00"]
  toSlots: string[];
  score: number; // Confidence/Impact score
}

export interface Group {
  id?: string;
  name: string;
  colleges?: string[];
  aliases: string[];
  color?: string;
}
