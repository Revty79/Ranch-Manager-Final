import { LoadingState } from "@/components/patterns/loading-state";

export default function EquipmentDetailLoadingPage() {
  return (
    <LoadingState
      title="Loading equipment detail"
      description="Pulling equipment maintenance history."
    />
  );
}

