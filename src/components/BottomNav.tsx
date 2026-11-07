import { Icon, type IconName } from './Icons';
import { Link, type Route } from '../lib/router';
import { haptic } from '../lib/ui';

const ITEMS: { id: string; to: string; label: string; icon: IconName }[] = [
  { id: 'home', to: '/', label: 'Home', icon: 'home' },
  { id: 'library', to: '/library', label: 'Library', icon: 'library' },
  { id: 'collections', to: '/collections', label: 'Browse', icon: 'collections' },
  { id: 'saved', to: '/saved', label: 'Saved', icon: 'saved' },
  { id: 'settings', to: '/settings', label: 'Settings', icon: 'settings' },
];

export function activeTab(route: Route): string {
  const first = route.seg[0] || '';
  if (first === '') return 'home';
  if (first === 'library' || first === 'game') return 'library';
  if (first === 'collections') return 'collections';
  if (first === 'saved') return 'saved';
  return 'settings';
}

export function BottomNav({ route }: { route: Route }) {
  const active = activeTab(route);
  return (
    <nav className="dock" aria-label="Main">
      <div className="dock-inner">
        {ITEMS.map((it) => (
          <Link key={it.id} to={it.to} aria-current={active === it.id ? 'page' : undefined} onClick={() => haptic(5)}>
            <span className="orb">
              <Icon name={it.icon} size={22} />
            </span>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
