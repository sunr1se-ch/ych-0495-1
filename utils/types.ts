export type PondCode = "A" | "B" | "C" | "D";

export interface Pond {
  id: number;
  code: PondCode;
  capacity_m3: number;
}

export interface Reading {
  id: number;
  pond_id: number;
  measured_at: string;
  baume_deg: number;
  level_cm: number;
  batch_tag: string;
}

export interface HarvestWindow {
  id: number;
  batch_tag: string;
  opened_at: string;
  closed_at: string | null;
  reason: string;
}

export interface ReadingInput {
  pond_code: PondCode;
  measured_at: string;
  baume_deg: number;
  level_cm: number;
  batch_tag: string;
}

export interface PondReading {
  date: string;
  baume_deg: number;
  level_cm: number;
}

export interface BatchTimeline {
  batch_tag: string;
  in_window: boolean;
  ponds: Record<PondCode, PondReading[]>;
  harvest_windows: HarvestWindow[];
}

export interface HarvestSuggestion {
  as_of: string;
  in_window: boolean;
  batch_tag: string;
  d_pool_conditions: {
    baume_ok_days: number;
    stable_level_days: number;
    latest_baume: number;
    latest_level_drop: number;
  };
  message: string;
}
