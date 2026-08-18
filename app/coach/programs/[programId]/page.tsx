import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercises as exercisesTable } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser, getProgramTree, listAssignableEngagements } from "@/lib/programs/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { addWeekAction, deleteExerciseGroupAction, deleteSessionAction } from "../actions";
import { AddSessionForm } from "./add-session-form";
import { AddExerciseForm } from "./add-exercise-form";
import { AssignForm } from "./assign-form";
import { BackButton } from "@/components/back-button";

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) notFound();

  const [treeResult, exerciseOptions] = await Promise.all([
    getProgramTree(programId, coachId),
    db.select({ id: exercisesTable.id, name: exercisesTable.name }).from(exercisesTable).orderBy(asc(exercisesTable.name)),
  ]);
  if (!treeResult.ok) notFound();
  const tree = treeResult.data;

  const assignableEngagements = tree.isTemplate ? await listAssignableEngagements(coachId) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">{tree.title}</h1>
      {tree.description && <p className="mt-1 text-sm text-muted-foreground">{tree.description}</p>}

      <div className="mt-6 flex flex-col gap-6">
        {tree.weeksByBlock.map((block) => (
          <div key={block.blockId} className="flex flex-col gap-4">
            {block.weeks.map((week) => (
              <Card key={week.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    Week {week.weekNumber} {week.isDeload && <Badge variant="secondary">Deload</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {week.sessions.map((session) => (
                    <div key={session.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{session.name}</p>
                        <form action={deleteSessionAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Remove
                          </Button>
                        </form>
                      </div>

                      <div className="mt-2 flex flex-col gap-2">
                        {session.groups.map((group) => (
                          <div key={group.id} className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm">
                            <span>
                              {group.exerciseName} — {group.sets.length} x {group.sets[0]?.repsMin}-{group.sets[0]?.repsMax} @{" "}
                              {group.sets[0]?.loadKg}kg
                            </span>
                            <form action={deleteExerciseGroupAction}>
                              <input type="hidden" name="id" value={group.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                ×
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>

                      <AddExerciseForm sessionId={session.id} exerciseOptions={exerciseOptions} />
                    </div>
                  ))}

                  <Separator />
                  <AddSessionForm programWeekId={week.id} />
                </CardContent>
              </Card>
            ))}

            <form action={addWeekAction.bind(null, block.blockId)}>
              <Button type="submit" variant="outline">
                Add week
              </Button>
            </form>
          </div>
        ))}
      </div>

      {tree.isTemplate && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Assign to a client</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignForm templateProgramId={tree.id} assignableEngagements={assignableEngagements} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
