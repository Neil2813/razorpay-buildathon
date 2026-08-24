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
  
  // Smooth scroll progress tracking state
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

      // Calculate progress clamp [0, 1] relative to container top
      const scrollOffset = -rect.top;
      const rawProgress = scrollOffset / totalScrollableHeight;
      targetProgressRef.current = Math.max(0, Math.min(1, rawProgress));
    };

    const updatePhysics = () => {
      // Direct lerp for ultra-smooth 60/120fps physics interpolation
      const diff = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(diff) > 0.0001) {
        currentProgressRef.current += diff * 0.15;
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

  // --- PHASE CALCULATIONS ---

  // Intro Heading (fades out early)
  const introOpacity = interpolate(p, 0.00, 0.12, 1, 0);
  const introY = interpolate(p, 0.00, 0.12, 0, -25); // px

  // Phase 1, 2, 5: Razorpay Card Transforms
  const cardScale = p < 0.18 
    ? interpolate(p, 0.00, 0.18, 0.82, 1.0)
    : p < 0.48 
      ? interpolate(p, 0.18, 0.48, 1.0, 0.92)
      : interpolate(p, 0.48, 0.72, 0.92, 0.82);

  const cardOpacity = p < 0.12 
    ? interpolate(p, 0.00, 0.10, 0.0, 1.0)
    : p < 0.52 
      ? 1.0 
      : interpolate(p, 0.52, 0.70, 1.0, 0.0);

  const cardY = p < 0.18
    ? interpolate(p, 0.00, 0.18, 4, 0) // vh (initial reveal move)
    : p < 0.48
      ? interpolate(p, 0.18, 0.48, 0, -35) // vh (parallax elevation)
      : interpolate(p, 0.48, 0.72, -35, -120); // vh (card exit)

  const cardShadowOpacity = p < 0.18 
    ? interpolate(p, 0.00, 0.18, 0, 0.8)
    : p < 0.55 
      ? 0.8 
      : interpolate(p, 0.55, 0.70, 0.8, 0);

  // Phase 3: Information Reveal Tags (Layer 2 parallax ~0.7x speed differential)
  const infoParallaxY = interpolate(p, 0.18, 0.55, 0, -18); // vh

  const tag1Opacity = interpolate(p, 0.20, 0.28, 0, 1);
  const tag1Y = interpolate(p, 0.20, 0.28, 25, 0);
  const tag1Blur = interpolate(p, 0.20, 0.28, 8, 0);

  const tag2Opacity = interpolate(p, 0.26, 0.34, 0, 1);
  const tag2Y = interpolate(p, 0.26, 0.34, 25, 0);
  const tag2Blur = interpolate(p, 0.26, 0.34, 8, 0);

  const tag3Opacity = interpolate(p, 0.32, 0.40, 0, 1);
  const tag3Y = interpolate(p, 0.32, 0.40, 25, 0);
  const tag3Blur = interpolate(p, 0.32, 0.40, 8, 0);

  const tag4Opacity = interpolate(p, 0.38, 0.46, 0, 1);
  const tag4Y = interpolate(p, 0.38, 0.46, 25, 0);
  const tag4Blur = interpolate(p, 0.38, 0.46, 8, 0);

  // General opacity for info group when exiting
  const infoGroupOpacity = p > 0.52 ? interpolate(p, 0.52, 0.65, 1, 0) : 1;

  // Phase 4: Glassbox Layer (Parallax Layer 2 ~0.7x differential)
  const glassOpacity = p < 0.28 
    ? interpolate(p, 0.24, 0.32, 0, 1)
    : p < 0.60 
      ? 1 
      : interpolate(p, 0.60, 0.72, 1, 0);

  const glassY = interpolate(p, 0.24, 0.70, 20, -30); // vh parallax drift

  // Phase 6 & 7: Payment Success PNG Transforms (Parallax Layer 4 ~0.85x speed)
  const paymentY = interpolate(p, 0.54, 0.82, 100, 0); // vh (100vh -> 0vh)
  const paymentScale = interpolate(p, 0.54, 0.82, 0.88, 1.0);
  const paymentOpacity = interpolate(p, 0.54, 0.72, 0, 1);

  // Phase 7 CTAs & Lock Info
  const ctaOpacity = interpolate(p, 0.80, 0.90, 0, 1);
  const ctaY = interpolate(p, 0.80, 0.90, 25, 0); // px

  // Scroll Indicator Hint
  const scrollPromptOpacity = interpolate(p, 0.00, 0.10, 1, 0);

  return (
    <section 
      ref={containerRef} 
      className="relative w-full bg-white select-none overflow-hidden" 
      style={{ height: '350vh' }}
    >
      {/* Sticky Viewport Stage (100vh pinned) */}
      <div className="sticky top-0 w-full h-screen bg-white overflow-hidden flex items-center justify-center">
        
        {/* Subtle background grid pattern for high-end fintech depth */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#032676 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Floating Minimal Header Intro (Phase 1) */}
        <div 
          className="absolute top-[12vh] z-20 text-center px-4 transition-transform ease-out pointer-events-none"
          style={{
            opacity: introOpacity,
            transform: `translate3d(0, ${introY}px, 0)`,
            display: introOpacity <= 0.01 ? 'none' : 'block'
          }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0149ae]/[0.06] border border-[#0149ae]/15 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#0149ae] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-widest text-[#0149ae] uppercase font-mono">
              GLASSBOX · TRUST LAYER
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#032676] uppercase">
            GLASSBOX
          </h1>
          <p className="mt-2 text-base md:text-lg text-slate-500 max-w-lg mx-auto font-light">
            Scroll to observe agentic payment authorization in real time.
          </p>
        </div>

        {/* Scroll Indicator Prompt */}
        <div 
          className="absolute bottom-[6vh] z-20 flex flex-col items-center gap-2 pointer-events-none text-[#0149ae]"
          style={{ opacity: scrollPromptOpacity }}
        >
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Scroll to Explore</span>
          <div className="w-5 h-8 border-2 border-slate-300 rounded-full flex justify-center p-1">
            <div className="w-1 h-2 bg-[#0149ae] rounded-full animate-bounce" />
          </div>
        </div>

        {/* LAYER 2: Translucent Vertical Glass Pane (Phase 4) */}
        <div
          className="absolute z-10 w-[90%] max-w-[580px] h-[340px] md:h-[400px] rounded-3xl pointer-events-none transition-all duration-75"
          style={{
            opacity: glassOpacity,
            transform: `translate3d(0, ${glassY}vh, 0)`,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(240, 246, 255, 0.35) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(1, 73, 174, 0.12)',
            boxShadow: '0 20px 50px rgba(1, 73, 174, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
          }}
        >
          {/* Specular highlight border sheen */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none" />
          <div className="absolute top-4 right-6 text-[10px] font-mono text-[#0149ae]/40 uppercase tracking-widest">
            PARALLAX GLASS STAGE
          </div>
        </div>

        {/* LAYER 2: Information Reveal Telemetry Elements (Phase 3) */}
        <div 
          className="absolute z-15 flex flex-col items-center gap-3.5 pointer-events-none w-full max-w-[460px] px-6"
          style={{
            opacity: infoGroupOpacity,
            transform: `translate3d(0, ${infoParallaxY}vh, 0)`
          }}
        >
          {/* Tag 1: AUTHORIZED */}
          <div 
            className="w-full bg-white/90 backdrop-blur-md border border-emerald-500/20 shadow-sm rounded-xl py-2.5 px-5 flex items-center justify-between"
            style={{
              opacity: tag1Opacity,
              transform: `translate3d(0, ${tag1Y}px, 0)`,
              filter: `blur(${tag1Blur}px)`
            }}
          >
            <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">STATE</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold tracking-wider text-emerald-600 font-mono">AUTHORIZED</span>
            </div>
          </div>

          {/* Tag 2: ₹4,000 LIMIT */}
          <div 
            className="w-full bg-white/90 backdrop-blur-md border border-[#0149ae]/15 shadow-sm rounded-xl py-2.5 px-5 flex items-center justify-between"
            style={{
              opacity: tag2Opacity,
              transform: `translate3d(0, ${tag2Y}px, 0)`,
              filter: `blur(${tag2Blur}px)`
            }}
          >
            <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">CEILING</span>
            <span className="text-sm font-bold tracking-tight text-[#032676]">₹4,000 LIMIT</span>
          </div>

          {/* Tag 3: RISK CHECK */}
          <div 
            className="w-full bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm rounded-xl py-2.5 px-5 flex items-center justify-between"
            style={{
              opacity: tag3Opacity,
              transform: `translate3d(0, ${tag3Y}px, 0)`,
              filter: `blur(${tag3Blur}px)`
            }}
          >
            <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">RISK ENGINE</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-[#0149ae] font-medium">PASSED 0.02</span>
              <span className="text-xs font-semibold text-slate-700 font-mono">RISK CHECK</span>
            </div>
          </div>

          {/* Tag 4: PAYMENT */}
          <div 
            className="w-full bg-white/90 backdrop-blur-md border border-[#0149ae]/20 shadow-sm rounded-xl py-2.5 px-5 flex items-center justify-between"
            style={{
              opacity: tag4Opacity,
              transform: `translate3d(0, ${tag4Y}px, 0)`,
              filter: `blur(${tag4Blur}px)`
            }}
          >
            <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">GATEWAY</span>
            <span className="text-xs font-bold tracking-widest text-[#0149ae] font-mono">PAYMENT ROUTED</span>
          </div>
        </div>

        {/* LAYER 3: Razorpay Card Asset (`razorpay-card.png`) */}
        <div
          className="absolute z-30 pointer-events-none flex flex-col items-center justify-center transition-transform ease-out"
          style={{
            opacity: cardOpacity,
            transform: `translate3d(0, ${cardY}vh, 0) scale(${cardScale})`,
            display: cardOpacity <= 0.005 ? 'none' : 'flex'
          }}
        >
          {/* Subtle minimal drop shadow underneath the physical card asset */}
          <div 
            className="absolute -bottom-6 w-[80%] h-8 bg-[#032676]/25 rounded-full blur-xl transition-opacity"
            style={{ opacity: cardShadowOpacity }}
          />

          <img 
            src="/razorpay-card.png" 
            alt="Razorpay Card"
            className="w-[85vw] max-w-[440px] md:max-w-[500px] h-auto object-contain drop-shadow-2xl"
            loading="eager"
          />
        </div>

        {/* LAYER 4: Payment Success Asset (`payment-success.png`) (Phase 6 & 7) */}
        <div
          className="absolute z-40 pointer-events-none flex flex-col items-center justify-center transition-transform ease-out"
          style={{
            opacity: paymentOpacity,
            transform: `translate3d(0, ${paymentY}vh, 0) scale(${paymentScale})`,
            display: paymentOpacity <= 0.005 ? 'none' : 'flex'
          }}
        >
          <img 
            src="/payment-success.png" 
            alt="Payment Successful"
            className="w-[90vw] max-w-[480px] md:max-w-[540px] h-auto object-contain drop-shadow-xl"
            loading="eager"
          />

          {/* Phase 7 Final Hero CTAs (fades in cleanly when centered) */}
          <div 
            className="mt-8 flex flex-col sm:flex-row items-center gap-4 pointer-events-auto"
            style={{
              opacity: ctaOpacity,
              transform: `translate3d(0, ${ctaY}px, 0)`
            }}
          >
            <Link 
              to={user ? '/checkout' : '/login'} 
              className="px-8 py-3.5 rounded-full bg-[#0149ae] hover:bg-[#032676] text-white font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              {user ? 'Open Checkout Cockpit' : 'Start Live Demo'}
            </Link>
            <Link 
              to="/register" 
              className="px-7 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-all border border-slate-200"
            >
              Create Account
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
