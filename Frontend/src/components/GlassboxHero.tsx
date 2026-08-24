import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Linear interpolation helper
function interpolate(p: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (p <= inMin) return outMin;
  if (p >= inMax) return outMax;
  const factor = (p - inMin) / (inMax - inMin);
  return outMin + factor * (outMax - outMin);
}

export default function GlassboxHero() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [progress, setProgress] = useState(0);
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalScrollableHeight = rect.height - windowHeight;

      if (totalScrollableHeight <= 0) return;

      const scrollOffset = -rect.top;
      const rawProgress = scrollOffset / totalScrollableHeight;
      targetProgressRef.current = Math.max(0, Math.min(1, rawProgress));
    };

    const updatePhysics = () => {
      const diff = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(diff) > 0.0001) {
        currentProgressRef.current += diff * 0.15; // Smooth physics
      } else {
        currentProgressRef.current = targetProgressRef.current;
      }

      setProgress(currentProgressRef.current);
      rafIdRef.current = requestAnimationFrame(updatePhysics);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();

    rafIdRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const p = progress;

  // --- REFINED TIMELINE (WITH 1-PAGE GAP) ---
  // Total container height is now 500vh.
  // 0.00 -> 0.10: Intro & Card Reveal
  // 0.10 -> 0.30: Card Parallax & Info Reveal
  // 0.30 -> 0.45: Card Exits
  // 0.45 -> 0.55: GAP (Empty white space)
  // 0.55 -> 0.65: Payment Success Enters
  // 0.65 -> 1.00: Payment Success Locked Centered

  const introOpacity = interpolate(p, 0.00, 0.05, 1, 0);
  const introY = interpolate(p, 0.00, 0.05, 0, -20);

  // 1. Razorpay Card Transforms: Primary Hero element at p=0
  const cardScale = p < 0.18 
    ? interpolate(p, 0.00, 0.18, 1.0, 0.90)
    : interpolate(p, 0.18, 0.32, 0.90, 0.75);

  const cardOpacity = p < 0.18 
    ? 1.0 
    : interpolate(p, 0.18, 0.32, 1.0, 0.0);

  const cardY = p < 0.18
    ? interpolate(p, 0.00, 0.18, 0, -10) // vh
    : interpolate(p, 0.18, 0.32, -10, -90); // vh (Exit)

  const cardShadowOpacity = p < 0.20 
    ? 0.7 
    : interpolate(p, 0.20, 0.32, 0.7, 0);

  // 2. Multi-Agent Architecture Diagram (`/Agents.png`): Enters ON SCROLL (p=0.18 -> 0.44)
  const agentsOpacity = p < 0.18
    ? 0.0
    : p < 0.24
      ? interpolate(p, 0.18, 0.24, 0.0, 1.0)
      : p < 0.36
        ? 1.0
        : interpolate(p, 0.36, 0.44, 1.0, 0.0);

  const agentsY = p < 0.18
    ? 40 // vh
    : p < 0.24
      ? interpolate(p, 0.18, 0.24, 40, 0) // vh
      : p < 0.36
        ? interpolate(p, 0.24, 0.36, 0, -15) // vh
        : interpolate(p, 0.36, 0.44, -15, -90); // vh (Exit)

  const agentsScale = p < 0.18
    ? 0.85
    : p < 0.24
      ? interpolate(p, 0.18, 0.24, 0.85, 1.0)
      : p < 0.36
        ? 1.0
        : interpolate(p, 0.36, 0.44, 1.0, 0.90);

  // 3. Kinetic Typography Watermark Layer: Enters right BEFORE Payment Success (p=0.40 -> 0.60)
  const typographyOpacity = p < 0.40
    ? 0.0
    : p < 0.46
      ? interpolate(p, 0.40, 0.46, 0.0, 1.0)
      : p < 0.54
        ? 1.0
        : interpolate(p, 0.54, 0.62, 1.0, 0.0);

  const typographyY = p < 0.40
    ? 30 // vh
    : p < 0.46
      ? interpolate(p, 0.40, 0.46, 30, 0) // vh
      : p < 0.54
        ? interpolate(p, 0.46, 0.54, 0, -10) // vh
        : interpolate(p, 0.54, 0.62, -10, -70); // vh

  const typographyScale = p < 0.40
    ? 0.9
    : p < 0.46
      ? interpolate(p, 0.40, 0.46, 0.9, 1.0)
      : p < 0.54
        ? 1.0
        : interpolate(p, 0.54, 0.62, 1.0, 0.95);

  // Scroll-triggered opposing horizontal row movements
  const row1X = interpolate(p, 0.38, 0.62, -220, 140);
  const row2X = interpolate(p, 0.38, 0.62, 140, -220);
  const row3X = interpolate(p, 0.38, 0.62, -180, 180);
  const row4X = interpolate(p, 0.38, 0.62, 180, -180);

  // 4. Payment Success (Enters at 0.58 -> 0.65, stays locked 0.65 -> 1.00)
  const paymentY = p < 0.65
    ? interpolate(p, 0.58, 0.65, 100, 0) // vh (100vh -> 0vh)
    : 0; 

  const paymentScale = p < 0.65
    ? interpolate(p, 0.58, 0.65, 0.85, 1.0)
    : 1.0;

  const paymentOpacity = p < 0.58 
    ? 0 
    : p < 0.62 
      ? interpolate(p, 0.58, 0.62, 0, 1) 
      : 1;

  // Final CTAs
  const ctaOpacity = interpolate(p, 0.65, 0.72, 0, 1);
  const ctaY = interpolate(p, 0.65, 0.72, 20, 0);

  const scrollPromptOpacity = interpolate(p, 0.00, 0.05, 1, 0);

  return (
    <section 
      ref={containerRef} 
      className="relative w-full bg-white select-none" 
      style={{ height: '500vh' }}
    >
      <div className="sticky top-0 w-full h-screen bg-white overflow-hidden flex items-center justify-center">
        
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#032676 1px, transparent 1px)`,
            backgroundSize: '28px 28px'
          }}
        />

        {/* Floating Header Intro */}
        <div 
          className="absolute top-[10vh] z-10 text-center px-4 pointer-events-none"
          style={{
            opacity: introOpacity,
            transform: `translate3d(0, ${introY}px, 0)`,
            display: introOpacity <= 0.005 ? 'none' : 'block'
          }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0149ae]/[0.06] border border-[#0149ae]/15 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0149ae] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-widest text-[#0149ae] uppercase font-mono">
              GLASSBOX · SCROLL INTERACTION
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#032676] uppercase">
            GLASSBOX
          </h1>
          <p className="mt-1.5 text-sm md:text-base text-slate-500 max-w-md mx-auto font-light">
            Scroll down to experience the continuous payment authorization stage.
          </p>
        </div>

        {/* Scroll Indicator Prompt */}
        <div 
          className="absolute bottom-[5vh] z-10 flex flex-col items-center gap-2 pointer-events-none text-[#0149ae]"
          style={{ opacity: scrollPromptOpacity }}
        >
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Scroll to Reveal</span>
          <div className="w-5 h-8 border-2 border-slate-300 rounded-full flex justify-center p-1">
            <div className="w-1 h-2 bg-[#0149ae] rounded-full animate-bounce" />
          </div>
        </div>

        {/* Multi-Agent Architecture Diagram (`/Agents.png`) */}
        <div
          className="absolute z-20 pointer-events-none flex flex-col items-center justify-center px-4"
          style={{
            opacity: agentsOpacity,
            transform: `translate3d(0, ${agentsY}vh, 0) scale(${agentsScale})`,
            display: agentsOpacity <= 0.005 ? 'none' : 'flex'
          }}
        >
          <img 
            src="/Agents.png" 
            alt="GlassBox Multi-Agent Architecture"
            className="w-[92vw] max-w-[850px] md:max-w-[1000px] h-auto object-contain drop-shadow-2xl rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md p-2 md:p-3 shadow-xl"
            loading="eager"
          />
        </div>

        {/* Kinetic Typography Watermark Layer (Enters right before payment success) */}
        <div
          className="absolute z-25 pointer-events-none flex flex-col items-center justify-center w-full overflow-hidden select-none"
          style={{
            opacity: typographyOpacity,
            transform: `translate3d(0, ${typographyY}vh, 0) scale(${typographyScale})`,
            display: typographyOpacity <= 0.005 ? 'none' : 'flex'
          }}
        >
          <div className="w-full flex flex-col items-center justify-center gap-1.5 sm:gap-3 md:gap-4 py-8 overflow-hidden">
            {/* Row 1: Agentic Commerce */}
            <div 
              className="whitespace-nowrap flex gap-10 text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-[#0149ae]/15 font-sans leading-none"
              style={{ transform: `translate3d(${row1X}px, 0, 0)` }}
            >
              <span>Agentic Commerce</span>
              <span>Agentic Commerce</span>
              <span>Agentic Commerce</span>
              <span>Agentic Commerce</span>
            </div>

            {/* Row 2: Explainable AI */}
            <div 
              className="whitespace-nowrap flex gap-10 text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-[#0149ae]/20 font-sans leading-none"
              style={{ transform: `translate3d(${row2X}px, 0, 0)` }}
            >
              <span>Explainable AI</span>
              <span>Explainable AI</span>
              <span>Explainable AI</span>
              <span>Explainable AI</span>
            </div>

            {/* Row 3: Auditable Decisions */}
            <div 
              className="whitespace-nowrap flex gap-10 text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-[#0149ae]/15 font-sans leading-none"
              style={{ transform: `translate3d(${row3X}px, 0, 0)` }}
            >
              <span>Auditable Decisions</span>
              <span>Auditable Decisions</span>
              <span>Auditable Decisions</span>
              <span>Auditable Decisions</span>
            </div>

            {/* Row 4: Trust Layer */}
            <div 
              className="whitespace-nowrap flex gap-10 text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-[#0149ae]/25 font-sans leading-none"
              style={{ transform: `translate3d(${row4X}px, 0, 0)` }}
            >
              <span>Trust Layer</span>
              <span>Trust Layer</span>
              <span>Trust Layer</span>
              <span>Trust Layer</span>
            </div>
          </div>
        </div>

        {/* Razorpay Card Asset (`razorpay-card.png`) */}
        <div
          className="absolute z-30 pointer-events-none flex flex-col items-center justify-center"
          style={{
            opacity: cardOpacity,
            transform: `translate3d(0, ${cardY}vh, 0) scale(${cardScale})`,
            display: cardOpacity <= 0.005 ? 'none' : 'flex'
          }}
        >
          <div 
            className="absolute -bottom-6 w-[80%] h-8 bg-[#032676]/25 rounded-full blur-xl transition-opacity"
            style={{ opacity: cardShadowOpacity }}
          />

          <img 
            src="/razorpay-card.png" 
            alt="Razorpay Card"
            className="w-[85vw] max-w-[480px] md:max-w-[560px] h-auto object-contain drop-shadow-2xl"
            loading="eager"
          />
        </div>

        {/* Payment Success Asset (`payment-success.png`) */}
        <div
          className="absolute z-40 flex flex-col items-center justify-center"
          style={{
            opacity: paymentOpacity,
            transform: `translate3d(0, ${paymentY}vh, 0) scale(${paymentScale})`,
            display: paymentOpacity <= 0.005 ? 'none' : 'flex',
            pointerEvents: paymentOpacity > 0.8 ? 'auto' : 'none'
          }}
        >
          {/* Increased size: w-[95vw] and max-w to 800/900px to keep it full size */}
          <img 
            src="/payment-success.png" 
            alt="Payment Successful"
            className="w-[95vw] max-w-[800px] md:max-w-[900px] h-auto object-contain drop-shadow-xl"
            loading="eager"
          />

          {/* Final Hero CTAs */}
          <div 
            className="mt-8 flex flex-col sm:flex-row items-center gap-4 pointer-events-auto"
            style={{
              opacity: ctaOpacity,
              transform: `translate3d(0, ${ctaY}px, 0)`
            }}
          >
            <Link 
              to={user ? '/checkout' : '/login'} 
              className="px-8 py-3.5 rounded-full bg-[#0149ae] hover:bg-[#032676] text-white font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-center"
            >
              {user ? 'Open Checkout Cockpit' : 'Start Live Demo'}
            </Link>
            <Link 
              to="/register" 
              className="px-7 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-all border border-slate-200 text-center"
            >
              Create Account
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
