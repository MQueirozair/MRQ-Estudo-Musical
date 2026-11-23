import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconPiano = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M8 5v8.5M12 5v8.5M16 5v8.5" />
  </svg>
);

export const IconFlow = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 17c3 0 3-10 6-10s3 10 6 10 3-6 4-6" />
  </svg>
);

export const IconLayers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

export const IconTarget = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const IconBook = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z" />
    <path d="M8 7h8M8 11h6" />
  </svg>
);

export const IconSparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" />
  </svg>
);

export const IconRuler = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 15 15 3l6 6L9 21l-6-6Z" />
    <path d="m7 11 2 2M11 7l2 2M11 15l2 2M15 11l2 2" />
  </svg>
);

export const IconEar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 8a5 5 0 1 1 10 0c0 2.4-1.6 3.4-2.6 5-.8 1.3-.5 3-2.2 3.6-1.4.5-2.7-.4-2.7-1.9" />
    <path d="M10 8a2 2 0 1 1 4 0c0 1.4-1.6 1.7-1.6 3.2" />
  </svg>
);

export const IconScale = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20V10M9.3 20V6M14.7 20v-8M20 20V4" />
  </svg>
);

export const IconEye = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconBolt = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
  </svg>
);

export const IconChart = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20h16M7 20v-7M12 20V7M17 20v-4" />
  </svg>
);

export const IconPen = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20l4-1 11-11a2.5 2.5 0 0 0-3.5-3.5L4.5 15.5 4 20Z" />
  </svg>
);

export const IconTrophy = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" />
    <path d="M12 13v4M9 20h6" />
  </svg>
);

export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 4.5 19 12 7 19.5v-15Z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconStop = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconVolume = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
  </svg>
);

export const IconMute = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const IconMidi = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 6v6M10.5 6v6M14.5 6v6M18.5 6v6" />
  </svg>
);

export const IconSun = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
);

export const IconMoon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 11a8 8 0 1 0-2.5 6.5" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconX = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconMenu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 20h16" />
  </svg>
);

export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconMusic = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);
