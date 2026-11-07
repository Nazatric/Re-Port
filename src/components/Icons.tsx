import {
  Accessibility,
  ArrowDownWideNarrow,
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Box,
  Brain,
  CalendarDays,
  Check,
  CircleCheck,
  CircleHelp,
  CircleSlash2,
  CloudOff,
  CodeXml,
  Compass,
  Cpu,
  Crosshair,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dices,
  Download,
  ExternalLink,
  Flag,
  Footprints,
  FolderOpen,
  Gamepad2,
  GitBranch,
  Ghost,
  Globe2,
  Hand,
  House,
  Info,
  Layers3,
  LayoutGrid,
  LibraryBig,
  List,
  ListFilter,
  MessagesSquare,
  Palette,
  Play,
  Plus,
  Puzzle,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trash2,
  TriangleAlert,
  Trophy,
  Type,
  X,
  Zap,
  type LucideProps,
} from 'lucide-react';

const ICONS = {
  home: House,
  library: LibraryBig,
  collections: Layers3,
  saved: Bookmark,
  savedOff: Bookmark,
  settings: Settings2,
  search: Search,
  filter: ListFilter,
  back: ArrowLeft,
  chevron: ChevronRight,
  chevronLeft: ChevronLeft,
  down: ChevronDown,
  download: Download,
  external: ExternalLink,
  check: Check,
  checkCircle: CircleCheck,
  warn: TriangleAlert,
  info: Info,
  block: CircleSlash2,
  help: CircleHelp,
  gamepad: Gamepad2,
  touch: Hand,
  folder: FolderOpen,
  clock: CalendarDays,
  calendar: CalendarDays,
  share: Share2,
  close: X,
  sort: ArrowDownWideNarrow,
  viewList: List,
  viewGrid: LayoutGrid,
  refresh: RotateCcw,
  cloudOff: CloudOff,
  send: Send,
  add: Plus,
  trash: Trash2,
  palette: Palette,
  textSize: Type,
  access: Accessibility,
  verified: BadgeCheck,
  bolt: Zap,
  globe: Globe2,
  github: CodeXml,
  gitlab: GitBranch,
  telegram: Send,
  discord: MessagesSquare,
  play: Play,
  action: Zap,
  shooter: Crosshair,
  adventure: Compass,
  rpg: Shield,
  platformer: Footprints,
  racing: Flag,
  strategy: Brain,
  horror: Ghost,
  fighting: Swords,
  simulation: SlidersHorizontal,
  puzzle: Puzzle,
  sports: Trophy,
  sandbox: Box,
  casual: Dices,
  indie: Sparkles,
  other: LayoutGrid,
  chip: Cpu,
  system: Globe2,
  sun: Zap,
  moon: CircleSlash2,
} satisfies Record<string, React.ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<LucideProps, 'size' | 'strokeWidth'>) {
  const Component = ICONS[name];
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />;
}

export function hasIcon(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

export function kindIcon(kind: string): IconName {
  switch (kind) {
    case 'github':
      return 'github';
    case 'gitlab':
      return 'gitlab';
    case 'telegram':
      return 'telegram';
    case 'discord':
      return 'discord';
    case 'playstore':
    case 'fdroid':
      return 'play';
    default:
      return 'globe';
  }
}