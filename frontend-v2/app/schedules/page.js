import { Suspense } from "react";
import { V2SchedulesPage } from "@/components/workspace/v2-schedules-page";

export default function SchedulesRoute() {
  return (
    <Suspense fallback={null}>
      <V2SchedulesPage />
    </Suspense>
  );
}
