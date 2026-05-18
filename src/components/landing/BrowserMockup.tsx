import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

interface BrowserMockupProps {
  src: string;
  url?: string;
  accent?: string;
}

export function BrowserMockup({ src, url = "consultoriodigital.app", accent = "#00c78a" }: BrowserMockupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    if (inView && !expanded) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [inView, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  return (
    <>
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

      {/* Expand button */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Ver en pantalla completa"
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-xs font-medium text-white/90 opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/75 hover:text-white group-hover:opacity-100 focus:opacity-100"
        style={{ boxShadow: `0 4px 20px -6px ${accent}40` }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ampliar</span>
      </button>

      {/* Subtle accent glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 60px ${accent}15`,
        }}
      />
    </div>

    {expanded && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8 animate-fade-in backdrop-blur-sm"
        onClick={() => setExpanded(false)}
      >
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Cerrar"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition-all hover:bg-white/15 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          className="relative w-full max-w-[1600px] rounded-2xl overflow-hidden border border-white/10"
          style={{
            backgroundColor: "#0a0a0a",
            boxShadow: `0 40px 120px -20px ${accent}40, 0 20px 60px -20px rgba(0,0,0,0.8)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <video
            ref={lightboxVideoRef}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="block w-full h-auto max-h-[88vh]"
          />
        </div>
      </div>
    )}
    </>
  );
}
