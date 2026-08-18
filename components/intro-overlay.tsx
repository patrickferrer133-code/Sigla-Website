"use client";

import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "sigla-intro-shown";

export function IntroOverlay() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (reduceMotion || alreadyShown) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setFading(true);
    setTimeout(() => setVisible(false), 500);
  };

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-background/30 backdrop-blur-md transition-opacity duration-500 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video ref={videoRef} autoPlay muted playsInline onEnded={dismiss} className="h-auto w-full max-w-md">
        <source src="/sigla-intro.webm" type="video/webm" />
        <source src="/sigla-intro.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
