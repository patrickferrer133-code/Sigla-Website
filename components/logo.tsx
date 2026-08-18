import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";

export function Logo({
  href = "/",
  className = "h-7",
  glow = false,
}: {
  href?: string;
  className?: string;
  glow?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      <Image
        src={logo}
        alt="Sigla"
        className={`w-auto ${className} ${glow ? "animate-logo-glow" : ""}`}
        priority
      />
    </Link>
  );
}
