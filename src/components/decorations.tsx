/** Hand-drawn style SVG ornaments. Decorative only: hidden from screen readers. */

export function HollySprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <path
        d="M30 22c-6-2-9-8-18-6 3 2 1 5 4 6-3 1-6 0-8 3 7 2 13 3 22-3z"
        fill="#1f4d3a"
        stroke="#163829"
        strokeWidth="1"
      />
      <path
        d="M34 22c6-2 9-8 18-6-3 2-1 5-4 6 3 1 6 0 8 3-7 2-13 3-22-3z"
        fill="#3c7a5a"
        stroke="#163829"
        strokeWidth="1"
      />
      <path d="M14 18c6 1 11 2 16 4M50 18c-6 1-11 2-16 4" stroke="#163829" strokeWidth=".8" fill="none" />
      <circle cx="28" cy="25" r="4.2" fill="#c4232f" />
      <circle cx="36" cy="25" r="4.2" fill="#9e1b32" />
      <circle cx="32" cy="19" r="4.2" fill="#c4232f" />
      <circle cx="30.6" cy="17.6" r="1.2" fill="#fff" opacity=".7" />
      <circle cx="26.6" cy="23.6" r="1.1" fill="#fff" opacity=".6" />
    </svg>
  );
}

export function RibbonDivider({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} role={label ? undefined : "presentation"}>
      <span aria-hidden="true" className="h-[3px] flex-1 rounded bg-gradient-to-r from-transparent via-cranberry/70 to-cranberry" />
      <svg viewBox="0 0 48 28" className="h-7 w-12 shrink-0" aria-hidden="true">
        <path d="M24 14C16 2 4 4 6 12s12 6 18 2z" fill="#c4232f" stroke="#6b0f1f" strokeWidth="1.2" />
        <path d="M24 14c8-12 20-10 18-2s-12 6-18 2z" fill="#c4232f" stroke="#6b0f1f" strokeWidth="1.2" />
        <path d="M22 15l-6 12 5-2 3 3 1-12zM26 15l6 12-5-2-3 3-1-12z" fill="#9e1b32" stroke="#6b0f1f" strokeWidth="1" />
        <circle cx="24" cy="14" r="3.6" fill="#9e1b32" stroke="#6b0f1f" strokeWidth="1.2" />
      </svg>
      {label && (
        <span className="font-display text-sm font-semibold tracking-wide text-berry-deep uppercase">{label}</span>
      )}
      <span aria-hidden="true" className="h-[3px] flex-1 rounded bg-gradient-to-l from-transparent via-cranberry/70 to-cranberry" />
    </div>
  );
}

export function WaxSeal({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="wax" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#e0434f" />
          <stop offset=".55" stopColor="#9e1b32" />
          <stop offset="1" stopColor="#5a0c19" />
        </radialGradient>
      </defs>
      <path
        d="M20 2c3 0 4 2 7 2s4 3 6 5 1 5 3 7 2 5 0 8-1 5-3 7-4 3-6 5-4 2-7 2-5-1-7-3-5-1-7-4-1-5-3-7-1-5 0-8 0-5 2-7 4-2 6-4 5-3 9-3z"
        fill="url(#wax)"
      />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#5a0c19" strokeOpacity=".5" strokeWidth="1.2" />
      <path d="M14 20.5l4 4 8-9" fill="none" stroke="#fffdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SnowCap({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 28" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        d="M0 0h1200v8c-30 0-40 14-70 14s-38-12-70-12-44 16-80 16-40-14-74-14-42 10-74 10-46-14-82-14-40 18-80 18-44-16-76-16-40 12-70 12-46-14-80-14-42 16-80 16-40-12-72-12-48 14-82 14-40-10-70-10-40 12-70 12S40 10 0 10z"
        fill="#fffdf8"
      />
    </svg>
  );
}

export function GiftIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="M2 9h20M12 9v12M12 9c-2-4-7-5-7-2s4 2 7 2zM12 9c2-4 7-5 7-2s-4 2-7 2z" />
    </svg>
  );
}

export function TreeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 4h-1.5l3.5 5h-2l4 6H5l4-6H7l3.5-5H9z" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function ListIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-2-1.3V4a1 1 0 011-1z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}
