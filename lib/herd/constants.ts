import type {
  AnimalEventType,
  AnimalGroupType,
  AnimalSex,
  AnimalSpecies,
  AnimalStatus,
  HerdProtocolType,
} from "@/lib/db/schema";

export const animalSpeciesOptions: Array<{ value: AnimalSpecies; label: string }> = [
  { value: "cattle", label: "Cattle" },
  { value: "horse", label: "Horse" },
  { value: "bison", label: "Bison" },
  { value: "sheep", label: "Sheep" },
  { value: "goat", label: "Goat" },
  { value: "swine", label: "Swine" },
  { value: "donkey", label: "Donkey" },
  { value: "mule", label: "Mule" },
  { value: "llama", label: "Llama" },
  { value: "alpaca", label: "Alpaca" },
  { value: "poultry", label: "Poultry" },
  { value: "other", label: "Other livestock" },
];

const animalSpeciesLabelByValue = new Map<AnimalSpecies, string>(
  animalSpeciesOptions.map((option) => [option.value, option.label] as const),
);

const animalSpeciesSortIndex = new Map<AnimalSpecies, number>(
  animalSpeciesOptions.map((option, index) => [option.value, index] as const),
);

export const animalSexOptions: Array<{ value: AnimalSex; label: string }> = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "castrated_male", label: "Castrated male" },
  { value: "unknown", label: "Unknown" },
];

export const animalStatusOptions: Array<{ value: AnimalStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold/disposed" },
  { value: "deceased", label: "Deceased/loss" },
  { value: "culled", label: "Culled" },
  { value: "transferred", label: "Transferred" },
  { value: "archived", label: "Archived" },
];

export const animalGroupTypeOptions: Array<{ value: AnimalGroupType; label: string }> = [
  { value: "management", label: "Management" },
  { value: "breeding", label: "Breeding" },
  { value: "health", label: "Health" },
  { value: "marketing", label: "Marketing" },
  { value: "custom", label: "Custom" },
];

export const lifecycleEventOptions: Array<{
  value: AnimalEventType;
  label: string;
  statusHint: string;
}> = [
  {
    value: "birth",
    label: "Birth",
    statusHint: "Sets current status to active.",
  },
  {
    value: "acquisition",
    label: "Acquisition / added to ranch",
    statusHint: "Sets current status to active.",
  },
  {
    value: "death",
    label: "Death / loss",
    statusHint: "Sets current status to deceased.",
  },
  {
    value: "sale_disposition",
    label: "Sale / disposition",
    statusHint: "Sets current status to sold.",
  },
  {
    value: "cull",
    label: "Cull / removed from breeding herd",
    statusHint: "Sets current status to culled.",
  },
  {
    value: "note",
    label: "Observation note",
    statusHint: "Keeps current status unchanged.",
  },
];

export const pregnancyOutcomeOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "open", label: "Open / not settled" },
  { value: "bred", label: "Bred / exposed" },
  { value: "confirmed", label: "Confirmed pregnant" },
] as const;

export const healthRecordTypeOptions = [
  { value: "vaccination", label: "Vaccination", eventType: "vaccination" as AnimalEventType },
  { value: "treatment", label: "Treatment", eventType: "treatment" as AnimalEventType },
  { value: "deworming", label: "Deworming", eventType: "deworming" as AnimalEventType },
  { value: "injury_illness", label: "Injury / illness note", eventType: "note" as AnimalEventType },
  { value: "procedure_exam", label: "Procedure / exam", eventType: "note" as AnimalEventType },
  { value: "death_loss_note", label: "Death/loss health note", eventType: "note" as AnimalEventType },
] as const;

export const protocolTypeOptions: Array<{ value: HerdProtocolType; label: string }> = [
  { value: "vaccination", label: "Vaccination reminder" },
  { value: "deworming", label: "Deworming reminder" },
  { value: "pregnancy_check", label: "Pregnancy-check reminder" },
  { value: "pre_breeding", label: "Pre-breeding planning reminder" },
  { value: "pre_birth_planning", label: "Pre-calving/foaling planning reminder" },
];

export function formatAnimalStatus(status: AnimalStatus): string {
  return status.replace("_", " ");
}

export function formatAnimalSex(sex: AnimalSex): string {
  return sex.replace("_", " ");
}

export function formatAnimalSpecies(species: AnimalSpecies): string {
  return animalSpeciesLabelByValue.get(species) ?? species.replace("_", " ");
}

export function compareAnimalSpecies(a: AnimalSpecies, b: AnimalSpecies): number {
  const aIndex = animalSpeciesSortIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bIndex = animalSpeciesSortIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aIndex !== bIndex) return aIndex - bIndex;
  return formatAnimalSpecies(a).localeCompare(formatAnimalSpecies(b));
}

export function formatAnimalEventType(eventType: AnimalEventType): string {
  return eventType.replace("_", " ");
}

export function formatAnimalGroupType(groupType: AnimalGroupType): string {
  return groupType.replace("_", " ");
}
