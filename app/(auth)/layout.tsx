import { AmbientBackground } from "@/components/ambient-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-4">
      <AmbientBackground />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
