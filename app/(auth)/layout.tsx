import { AmbientBackground } from "@/components/ambient-background";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <AmbientBackground />
      <Logo className="h-8" glow />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
