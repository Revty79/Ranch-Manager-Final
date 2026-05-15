import type {
  EquipmentStatus,
  EquipmentType,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
} from "@/lib/db/schema";

export const equipmentTypeOptions: Array<{ value: EquipmentType; label: string }> = [
  { value: "truck", label: "Truck" },
  { value: "tractor", label: "Tractor" },
  { value: "trailer", label: "Trailer" },
  { value: "atv", label: "ATV" },
  { value: "utv", label: "UTV" },
  { value: "implement", label: "Implement" },
  { value: "pump", label: "Pump" },
  { value: "tool", label: "Tool" },
  { value: "other", label: "Other" },
];

export const equipmentStatusOptions: Array<{ value: EquipmentStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "needs_maintenance", label: "Needs maintenance" },
  { value: "down", label: "Down" },
  { value: "retired", label: "Retired" },
];

export const maintenanceTypeOptions: Array<{ value: MaintenanceType; label: string }> = [
  { value: "routine", label: "Routine" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
  { value: "oil_change", label: "Oil change" },
  { value: "tire", label: "Tire" },
  { value: "fluids", label: "Fluids" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
];

export const maintenanceStatusOptions: Array<{ value: MaintenanceStatus; label: string }> = [
  { value: "scheduled", label: "Scheduled" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const maintenancePriorityOptions: Array<{ value: MaintenancePriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const equipmentTypeLabelByValue = new Map(equipmentTypeOptions.map((option) => [option.value, option.label]));
const equipmentStatusLabelByValue = new Map(
  equipmentStatusOptions.map((option) => [option.value, option.label]),
);
const maintenanceTypeLabelByValue = new Map(
  maintenanceTypeOptions.map((option) => [option.value, option.label]),
);
const maintenanceStatusLabelByValue = new Map(
  maintenanceStatusOptions.map((option) => [option.value, option.label]),
);
const maintenancePriorityLabelByValue = new Map(
  maintenancePriorityOptions.map((option) => [option.value, option.label]),
);

export function formatEquipmentType(value: EquipmentType): string {
  return equipmentTypeLabelByValue.get(value) ?? value.replace("_", " ");
}

export function formatEquipmentStatus(value: EquipmentStatus): string {
  return equipmentStatusLabelByValue.get(value) ?? value.replace("_", " ");
}

export function formatMaintenanceType(value: MaintenanceType): string {
  return maintenanceTypeLabelByValue.get(value) ?? value.replace("_", " ");
}

export function formatMaintenanceStatus(value: MaintenanceStatus): string {
  return maintenanceStatusLabelByValue.get(value) ?? value.replace("_", " ");
}

export function formatMaintenancePriority(value: MaintenancePriority): string {
  return maintenancePriorityLabelByValue.get(value) ?? value.replace("_", " ");
}

