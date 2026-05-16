import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Too Fresh To Waste — Rescue unsold food. Save up to 70%. Help the planet.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: 'hsl(174,72%,17%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        fontFamily: 'Georgia, serif',
        overflow: 'hidden',
      }}
    >
      {/* Top-right glow */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,84,73,0.25) 0%, transparent 70%)',
        }}
      />
      {/* Bottom-left glow */}
      <div
        style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,160,0,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          padding: '64px 72px',
        }}
      >
        {/* Top — brand name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#F55449',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width='28' height='28' viewBox='0 0 24 24' fill='white'>
              <path d='M11 20A7 7 0 014 13c0-5 4-9 8-11 4 2 8 6 8 11a7 7 0 01-7 7c-1 0-1.4-.1-2-.3' />
              <path
                d='M12 9c0 5-4 9-8 11'
                fill='none'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
              />
            </svg>
          </div>
          <span
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Too Fresh To Waste
          </span>
        </div>

        {/* Center — headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(245,84,73,0.2)',
              border: '1px solid rgba(245,84,73,0.4)',
              borderRadius: 100,
              padding: '8px 20px',
              width: 'fit-content',
            }}
          >
            <span
              style={{
                color: '#F55449',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Available in Tunisia
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                color: 'white',
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
              }}
            >
              Great Food.
            </span>
            <span
              style={{
                color: '#F55449',
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                fontStyle: 'italic',
                letterSpacing: '-0.03em',
              }}
            >
              Lower Price.
            </span>
            <span
              style={{
                color: 'white',
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
              }}
            >
              Better World.
            </span>
          </div>

          <span
            style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 1.5, maxWidth: 640 }}
          >
            Rescue unsold food from restaurants & bakeries at up to 70% off. Earn points. Win
            prizes.
          </span>
        </div>

        {/* Bottom — stats row */}
        <div style={{ display: 'flex', gap: 40 }}>
          {[
            { value: 'Up to 70%', label: 'off retail price' },
            { value: 'Earn points', label: 'with every bag' },
            { value: 'Win prizes', label: 'phones & watches' },
          ].map(stat => (
            <div key={stat.value} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{stat.value}</span>
              <span
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 14,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right edge accent bar */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: '#F55449',
        }}
      />
    </div>,
    { width: 1200, height: 630 },
  );
}
