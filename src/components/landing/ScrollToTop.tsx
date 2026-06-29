// Minimalist "back to top" button. Fixed bottom-left (clear of the bottom-right
// chat widget); fades in after scrolling down and smooth-scrolls to top.
import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Subir al inicio"
      className={`fixed bottom-6 left-6 z-40 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/10 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
      style={{
        backgroundColor: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <ArrowUp className="w-5 h-5 text-white/80" />
    </button>
  );
}
