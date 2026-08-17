import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser, listCoachTemplates } from "@/lib/programs/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTemplateForm } from "./new-template-form";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";

export default async function ProgramsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const templates = await listCoachTemplates(coachId);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Program templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build a template once, then assign it to any client.
      </p>

      <div className="mt-6 grid gap-3">
        {templates.map((template) => (
          <Link key={template.id} href={`/coach/programs/${template.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="text-base">{template.title}</CardTitle>
              </CardHeader>
              {template.description && (
                <CardContent className="text-sm text-muted-foreground">{template.description}</CardContent>
              )}
            </Card>
          </Link>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet — create your first one below.</p>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">New template</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
