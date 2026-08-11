/** Hand drawn inline SVG. No icon library: 0 KB, and every stroke is on brand. */
type P = { size?: number }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
})

export const MicOn = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
  </svg>
)

export const MicOff = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M15 9V5a3 3 0 0 0-5.9-.7M9 9v4a3 3 0 0 0 5 2.2" />
    <path d="M5 10a7 7 0 0 0 10.7 6M19 10v1a7 7 0 0 1-.3 2M12 17v4M8 21h8M3 3l18 18" />
  </svg>
)

export const CamOn = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <rect x="2" y="6" width="13" height="12" rx="3" />
    <path d="M15 11l7-4v10l-7-4z" />
  </svg>
)

export const CamOff = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M9 6h3a3 3 0 0 1 3 3v1M15 15v0a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 2-2.8" />
    <path d="M15 11l7-4v10l-4-2.3M3 3l18 18" />
  </svg>
)

export const Chat = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" />
    <path d="M8 11h8M8 15h5" />
  </svg>
)

export const People = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
    <path d="M16 5.3A3.2 3.2 0 0 1 16 11M18 14a5 5 0 0 1 3 4.6V20" />
  </svg>
)

export const Settings = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
)

export const Hand = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V6a1.5 1.5 0 0 1 3 0v6" />
    <path d="M16 9.5A1.5 1.5 0 0 1 19 10v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-1a1.5 1.5 0 0 1 3 0" />
  </svg>
)

export const Ghost = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 20V10a8 8 0 0 1 16 0v10l-2.7-2-2.6 2-2.7-2-2.7 2L6.7 18 4 20z" />
    <path d="M9.5 10h.01M14.5 10h.01" />
  </svg>
)

export const Smile = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
  </svg>
)

export const Leave = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8M17 15l4-3-4-3M21 12H10" />
  </svg>
)

export const Close = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Send = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12l16-8-6 8 6 8-16-8z" />
  </svg>
)

export const Crown = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M4 18h16M4 18l-1-9 5 4 4-7 4 7 5-4-1 9" />
  </svg>
)

export const Dice = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8.5 8.5h.01M15.5 15.5h.01M12 12h.01" />
  </svg>
)

export const Desk = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 14h16M6 14v5M18 14v5M5 10h14v4H5z" />
  </svg>
)

export const Away = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const Active = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l2.5 2.5L16 9" />
  </svg>
)
