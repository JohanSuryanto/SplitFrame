// Small line icons (20×20, currentColor). Decorative: always paired with a text label or aria-label.
import type { ReactNode } from 'react';

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const LogoMark = () => (
  <Icon size={22}>
    <rect x="2.5" y="2.5" width="15" height="15" rx="3" />
    <path d="M9 2.5v15M9 10.5h8.5" />
  </Icon>
);

export const LayoutIcon = () => (
  <Icon>
    <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
    <path d="M10 2.5v15M2.5 10H10" />
  </Icon>
);

export const DrawIcon = () => (
  <Icon>
    <path d="M3.5 16.5 5 12 13.5 3.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8 15l-4.5 1.5Z" />
    <path d="m12 5 3 3" />
  </Icon>
);

export const StyleIcon = () => (
  <Icon>
    <path d="M3 6h8M15 6h2M3 14h2M9 14h8" />
    <circle cx="13" cy="6" r="2" />
    <circle cx="7" cy="14" r="2" />
  </Icon>
);

export const UndoIcon = () => (
  <Icon>
    <path d="M7 5 3 9l4 4" />
    <path d="M3.5 9H12a4.5 4.5 0 0 1 0 9h-2" />
  </Icon>
);

export const RedoIcon = () => (
  <Icon>
    <path d="m13 5 4 4-4 4" />
    <path d="M16.5 9H8a4.5 4.5 0 0 0 0 9h2" />
  </Icon>
);

export const EyeIcon = () => (
  <Icon>
    <path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10Z" />
    <circle cx="10" cy="10" r="2.4" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M10 3v10M6 9l4 4 4-4M4 16.5h12" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="m5 5 10 10M15 5 5 15" />
  </Icon>
);
