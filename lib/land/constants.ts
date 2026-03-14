import type { LandUnitType, MovementReason } from "@/lib/db/schema";

export const landUnitTypeOptions: Array<{ value: LandUnitType; label: string }> = [
  { value: "pasture", label: "Pasture" },
  { value: "field", label: "Field" },
  { value: "trap", label: "Trap" },
  { value: "lot", label: "Lot" },
  { value: "corral", label: "Corral" },
  { value: "pen", label: "Pen" },
  { value: "stall", label: "Stall" },
  { value: "barn_area", label: "Barn area" },
  { value: "holding_area", label: "Holding area" },
  { value: "other", label: "Other" },
];

export const movementReasonOptions: Array<{ value: MovementReason; label: string }> = [
  { value: "grazing_rotation", label: "Grazing rotation" },
  { value: "feeding", label: "Feeding / supplement access" },
  { value: "breeding", label: "Breeding workflow" },
  { value: "health_hold", label: "Health hold / treatment" },
  { value: "weaning", label: "Weaning / separation" },
  { value: "training", label: "Training / handling" },
  { value: "weather", label: "Weather / shelter move" },
  { value: "other", label: "Other movement reason" },
];

export const handlingUnitTypes: LandUnitType[] = [
  "corral",
  "pen",
  "stall",
  "barn_area",
  "holding_area",
];

export function formatLandUnitType(unitType: LandUnitType): string {
  return unitType.replace("_", " ");
}

export function formatMovementReason(reason: MovementReason): string {
  return reason.replace("_", " ");
}
