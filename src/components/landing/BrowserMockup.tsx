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
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-white/5"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div
            className="h-5 rounded-md px-3 flex items-center"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono">{url}</span>
          </div>
        </div>
      </div>

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
