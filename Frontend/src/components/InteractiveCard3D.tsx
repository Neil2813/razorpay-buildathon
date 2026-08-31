import React, { useState } from 'react';
import { ShieldCheck, Wifi, CreditCard } from 'lucide-react';

interface InteractiveCard3DProps {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvv: string;
  focusedField: string | null;
  paymentMethod: string;
}

export default function InteractiveCard3D({
  cardNumber,
  cardHolder,
  expiry,
  cvv,
  focusedField,
  paymentMethod
}: InteractiveCard3DProps) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setRotate({
      x: -(y / rect.height) * 20,
      y: (x / rect.width) * 20
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  const isFlipped = focusedField === 'cvv';

  const getBrandLogo = () => {
    const cleanNum = cardNumber.replace(/\s/g, '');
    if (cleanNum.startsWith('4')) return 'VISA';
    if (cleanNum.startsWith('5')) return 'MASTERCARD';
    if (cleanNum.startsWith('3')) return 'AMEX';
    if (paymentMethod === 'upi') return 'UPI FAST';
    if (paymentMethod === 'crypto') return 'USDT CRYPTO';
    return 'GLASSBOX CARD';
  };

  const formattedNum = cardNumber || '•••• •••• •••• ••••';

  return (
    <div
      style={{
        perspective: '1000px',
        width: '100%',
        maxWidth: '380px',
        height: '210px',
        margin: '0 auto 1.5rem auto',
        cursor: 'pointer'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: `rotateX(${rotate.x}deg) rotateY(${isFlipped ? 180 : rotate.y}deg)`
        }}
      >
        {/* CARD FRONT */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #111111 0%, #1e1e24 50%, #0044ff 100%)',
            color: '#ffffff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255,255,255,0.3)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            overflow: 'hidden'
          }}
        >
          {/* Metallic Sheen Effect Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 60%)',
              pointerEvents: 'none',
              transform: `translate(${rotate.y * 2}px, ${rotate.x * 2}px)`
            }}
          />

          {/* Top Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '24px',
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{ width: '18px', height: '14px', border: '1px solid rgba(255,255,255,0.6)', borderRadius: '2px' }} />
              </div>
              <Wifi size={18} style={{ opacity: 0.8 }} />
            </div>

            <div
              style={{
                fontFamily: "'Antonio', sans-serif",
                fontWeight: 800,
                fontSize: '0.95rem',
                letterSpacing: '0.08em',
                background: 'linear-gradient(90deg, #ffffff 0%, #a1a1aa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {getBrandLogo()}
            </div>
          </div>

          {/* Card Number */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '1.25rem',
              letterSpacing: '0.15em',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              zIndex: 1,
              marginTop: '0.5rem'
            }}
          >
            {formattedNum}
          </div>

          {/* Bottom Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
                CARD HOLDER
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                {cardHolder || 'VALUED CUSTOMER'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
                EXPIRES
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700 }}>
                {expiry || 'MM/YY'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85, fontSize: '0.68rem' }}>
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>GLASSBOX SECURE</span>
            </div>
          </div>
        </div>

        {/* CARD BACK */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #18181b 0%, #111111 100%)',
            color: '#ffffff',
            transform: 'rotateY(180deg)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.25rem 0'
          }}
        >
          {/* Magnetic Stripe */}
          <div style={{ width: '100%', height: '40px', background: '#000000', marginTop: '0.5rem' }} />

          {/* CVV Box */}
          <div style={{ padding: '0 1.5rem' }}>
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', opacity: 0.6, textAlign: 'right', marginBottom: '4px' }}>
              CVV / CVC SECURITY CODE
            </div>
            <div
              style={{
                background: '#ffffff',
                color: '#111111',
                height: '36px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '1rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '1rem',
                letterSpacing: '0.2em'
              }}
            >
              {cvv || '•••'}
            </div>
          </div>

          <div style={{ padding: '0 1.5rem', fontSize: '0.65rem', opacity: 0.5, textAlign: 'center' }}>
            Authorized signature · Not valid unless signed · GLASSBOX Agentic Guardrails Active
          </div>
        </div>
      </div>
    </div>
  );
}
