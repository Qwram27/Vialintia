import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 16, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  )
}

export const IconFlask = (p: P) => (
  <Base {...p}><path d="M9 3h6M10 3v6.5L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9.5V3" /><path d="M7.5 15h9" /></Base>
)
export const IconBook = (p: P) => (
  <Base {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></Base>
)
export const IconCompare = (p: P) => (
  <Base {...p}><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /><path d="M6.5 9h0M17.5 12h0" /></Base>
)
export const IconSettings = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Base>
)
export const IconPlus = (p: P) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
export const IconTrash = (p: P) => (
  <Base {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></Base>
)
export const IconCopy = (p: P) => (
  <Base {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></Base>
)
export const IconSearch = (p: P) => <Base {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Base>
export const IconGrip = (p: P) => (
  <Base {...p} strokeWidth={2.4}><path d="M9 6h0M9 12h0M9 18h0M15 6h0M15 12h0M15 18h0" /></Base>
)
export const IconUndo = (p: P) => <Base {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Base>
export const IconRedo = (p: P) => <Base {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Base>
export const IconDownload = (p: P) => <Base {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Base>
export const IconUpload = (p: P) => <Base {...p}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></Base>
export const IconFile = (p: P) => (
  <Base {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Base>
)
export const IconX = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>
export const IconChevronLeft = (p: P) => <Base {...p}><path d="M15 18l-6-6 6-6" /></Base>
export const IconCheck = (p: P) => <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
export const IconAlert = (p: P) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h0" /></Base>
export const IconSort = (p: P) => <Base {...p}><path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M14 6h7M14 11h5M14 16h3" /></Base>
export const IconLayers = (p: P) => (
  <Base {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></Base>
)
export const IconFolder = (p: P) => <Base {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Base>
export const IconDrop = (p: P) => <Base {...p}><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" /></Base>
export const IconReset = (p: P) => <Base {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></Base>
