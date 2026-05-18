import { useEffect, useRef, useState } from "react";

interface BrowserMockupProps {
  src: string;
  url?: string;
  accent?: string;
}

export function BrowserMockup({ src, url = "consultoriodigital.app", accent = "#00c78a" }: BrowserMockupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [inView]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 group"
      style={{
        backgroundColor: "#0a0a0a",
        boxShadow: `0 25px 70px -20px ${accent}25, 0 10px 30px -10px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        className="block w-full h-auto"
        style={{ display: "block" }}
      />

      {/* Subtle accent glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 60px ${accent}15`,
        }}
      />
    </div>
  );
}
