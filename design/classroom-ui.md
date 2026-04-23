# Engagio-LMS Classroom UI Design System

## Overview
A comprehensive "Blackboard-meets-Zoom" educational environment using LiveKit v2 patterns, Next.js, and Tailwind CSS.

## Color Palette

### Primary (Engagio)
| Shade | Hex |
|-------|-----|
| 50 | `#f0f9ff` |
| 100 | `#e0f2fe` |
| 200 | `#bae6fd` |
| 300 | `#7dd3fc` |
| 400 | `#38bdf8` |
| 500 | `#0ea5e9` |
| 600 | `#0284c7` |
| 700 | `#0369a1` |
| 800 | `#075985` |
| 900 | `#0c4a6e` |
| 950 | `#082f49` |

### Semantic (Edu)
| Token | Hex | Usage |
|-------|-----|-------|
| slate | `#1e293b` | Sidebar background |
| dark | `#0f172a` | App background |
| accent | `#f59e0b` | Hand raise, warnings |
| danger | `#ef4444` | Mute, leave, errors |
| success | `#22c55e` | Speaking indicator, online |

## Typography
- Font: Inter (300, 400, 500, 600, 700)
- Body: 14px/0.875rem
- Small: 12px/0.75rem, 10px/0.625rem
- Scale: `text-xs` for labels, `text-sm` for body, `text-xl` for headings

## Layout Architecture

### Zones
| Zone | Component | Purpose |
|------|-----------|---------|
| **Top Bar** | `GlassHeader` | Class info, global controls |
| **Primary Stage** | `FocusLayoutContainer` | Active speaker, screen share, whiteboard |
| **Filmstrip** | `CarouselLayout` | Horizontal participant thumbnails |
| **Sidebar** | `CollapsiblePanels` | Chat, Participants, Q&A |
| **Control Bar** | `FloatingControls` | Media, engagement, session controls |

### View Modes
1. **Focus** - Main speaker + filmstrip below
2. **Grid** - Equal tiles, 2-4 columns responsive
3. **Immersive** - Full stage, no filmstrip

## Component Specifications

### Glass Panel
```css
background: rgba(15, 23, 42, 0.85);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 12-16px;
```

### Video Tile
```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
hover: translateY(-2px), shadow-lg;

/* Speaking state */
box-shadow: 0 0 0 2px #22c55e, 0 0 20px rgba(34, 197, 94, 0.3);

/* Muted state */
border: 2px solid #ef4444;
```

### Control Button
```css
transition: all 0.2s ease;
active: scale(0.95);
active-state-bg: #1e293b;
tooltip: absolute -top-8, bg-gray-900, text-[10px];
```

## Animations

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| pulse-ring | 2s infinite | cubic-bezier(0.4,0,0.6,1) | Recording indicator |
| float | 3s infinite | ease-in-out | Empty states |
| slide-in | 0.3s | ease-out | Sidebar, toasts |
| fade-in | 0.2s | ease-out | Chat messages, panels |
| audio-bar | 0.1s | ease | Audio visualizer |

## Responsive Breakpoints

| Breakpoint | Sidebar | Controls | Filmstrip |
|------------|---------|----------|-----------|
| Desktop (>1024px) | Fixed 320px | Floating bar | Horizontal |
| Tablet (768-1024px) | Collapsible | 48px touch targets | Horizontal |
| Mobile (<768px) | Bottom sheet | Compact | Vertical option |

## Accessibility

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Mute/Unmute | `Ctrl + D` |
| Start/Stop Video | `Ctrl + E` |
| Raise Hand | `Ctrl + R` |
| Toggle Chat | `Ctrl + Shift + C` |
| Toggle Sidebar | `Ctrl + B` |
| Accessibility Panel | `Alt + A` |
| Shortcuts Help | `?` |

### High Contrast Mode
- All buttons: `border: 2px solid currentColor`
- Video tiles: `border: 2px solid #fff`
- Speaking ring: `box-shadow: 0 0 0 4px #ffff00, 0 0 0 6px #000`

## LiveKit v2 Integration

### Key Hooks
- `useIsSpeaking(participant)` → green ring
- `useTrackMutedIndicator(trackRef)` → mute icon
- `useParticipants()` → participant list

### Component Mapping
| Our Component | LiveKit v2 |
|---------------|-----------|
| FocusLayout | `<FocusLayout />` |
| CarouselLayout | `<CarouselLayout orientation="horizontal" />` |
| TrackMutedIndicator | `<TrackMutedIndicator />` |
| AudioVisualizer | `<AudioVisualizer />` |

## State Management

### Local State
```typescript
interface ClassroomState {
  micMuted: boolean;
  cameraOff: boolean;
  handRaised: boolean;
  sidebarOpen: boolean;
  sidebarTab: 'chat' | 'participants' | 'qa';
  viewMode: 'focus' | 'grid' | 'immersive';
  screenSharing: boolean;
  whiteboardActive: boolean;
  highContrast: boolean;
}
```

### Participant Tile Data
```typescript
interface Participant {
  id: string;
  name: string;
  role: 'host' | 'student' | 'teacher';
  speaking: boolean;
  muted: boolean;
  video: boolean;
  avatar?: string;
}
```

## Assets & Icons
- Icon library: Lucide React
- All icons 20px (w-5 h-5) for controls, 16px (w-4 h-4) for inline

## File Structure
```
app/dashboard/classroom/page.tsx
components/classroom/
  ClassroomContent.tsx      # Main layout orchestrator
  FocusLayout.tsx           # Primary stage with view modes
  GridLayout.tsx            # Grid view
  Filmstrip.tsx             # Horizontal participant carousel
  VideoTile.tsx             # Individual participant tile
  ControlBar.tsx            # Floating bottom controls
  GlassHeader.tsx           # Top navigation bar
  Sidebar.tsx               # Collapsible side panel
    ChatPanel.tsx
    ParticipantsPanel.tsx
    QAPanel.tsx
  AudioVisualizer.tsx       # Audio level bars
  ToastContainer.tsx         # Notification system
  AccessibilityPanel.tsx     # Alt+A settings
  KeyboardShortcuts.tsx      # ? help modal
```
