import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser, getSessionPageData } from "@/lib/logging/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetLogRow } from "./set-log-row";
import { CompleteSessionForm } from "./complete-session-form";
import { BackButton } from "@/components/back-button";

export default async function SessionLoggerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) notFound();

  const pageDataResult = await getSessionPageData(sessionId, clientId);
  if (!pageDataResult.ok) notFound();
  const { detail, sessionLogId } = pageDataResult.data;

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">{detail.sessionName}</h1>

      <div className="mt-6 flex flex-col gap-4">
        {detail.exercises.map((exercise) => (
          <Card key={exercise.groupId}>
            <CardHeader>
              <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
              {exercise.cues.length > 0 && <p className="text-sm text-muted-foreground">{exercise.cues[0]}</p>}
              {exercise.previousPerformance && (
                <p className="text-xs text-muted-foreground">
                  Last time: {exercise.previousPerformance.reps} reps @ {exercise.previousPerformance.loadKg}kg
                </p>
              )}
            </CardHeader>
            <CardContent className="flex flex-col">
              {exercise.prescriptions.map((set) => (
                <SetLogRow
                  key={set.setNumber}
                  sessionLogId={sessionLogId}
                  exerciseId={exercise.exerciseId}
                  setPrescriptionId={set.id}
                  setNumber={set.setNumber}
                  repsMin={set.repsMin}
                  repsMax={set.repsMax}
                  defaultLoadKg={exercise.previousPerformance?.loadKg ?? set.loadKg ?? 20}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Finish session</CardTitle>
        </CardHeader>
        <CardContent>
          <CompleteSessionForm sessionLogId={sessionLogId} />
        </CardContent>
      </Card>
    </div>
  );
}
