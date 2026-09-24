import React, { useState } from 'react';
import {
  Users,
  Calendar,
  Clock,
  BarChart2,
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  SpeakerPodiumIcon,
  WomenTableDiscussionIcon,
  PreacherManWithBagIcon,
  WomenWithLiteratureCartIcon,
} from './SectionIcons';
import { SectionKey } from './ModernSectionHub';

interface ModernSquareNavbarProps {
  activeTab: SectionKey | 'hub';
  onSelectTab: (tab: SectionKey | 'hub') => void;
  peopleCount: number;
}

type NavItem = {
  id: SectionKey | 'hub';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  group?: 'main' | 'programmi' | 'servizio' | 'gestione';
};

const groupLabels: Record<NonNullable<NavItem['group']>, string> = {
  main: '',
  programmi: 'Programmi',
  servizio: 'Servizio',
  gestione: 'Gestione',
};

export const ModernSquareNavbar: React.FC<ModernSquareNavbarProps> = ({
  activeTab,
  onSelectTab,
  peopleCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { id: 'hub', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
    { id: 'anagrafica', label: 'Persone', icon: Users, badge: peopleCount, group: 'main' },
    { id: 'mensile', label: 'Programma mensile', icon: Calendar, group: 'programmi' },
    { id: 'domenica', label: 'Adunanza domenica', icon: SpeakerPodiumIcon, group: 'programmi' },
    { id: 'vitaEMinistero', label: 'Vita e ministero', icon: WomenTableDiscussionIcon, group: 'programmi' },
    { id: 'servizioCampo', label: 'Servizio di campo', icon: PreacherManWithBagIcon, group: 'servizio' },
    { id: 'operaPubblica', label: 'Opera pubblica', icon: WomenWithLiteratureCartIcon, group: 'servizio' },
    { id: 'impostazioni', label: 'Assenze e calendario', icon: Clock, group: 'gestione' },
    { id: 'statistiche', label: 'Statistiche', icon: BarChart2, group: 'gestione' },
  ];

  const select = (id: NavItem['id']) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  const navContent = (
    <nav className="app-nav-list" aria-label="Navigazione principale">
      {(['main', 'programmi', 'servizio', 'gestione'] as const).map((group) => (
        <div key={group} className="app-nav-group">
          {groupLabels[group] && <div className="app-nav-group-label">{groupLabels[group]}</div>}
          {navItems.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                className={`app-nav-item ${isActive ? 'is-active' : ''}`}
              >
                <span className="app-nav-icon"><Icon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.badge !== undefined && <span className="app-nav-badge">{item.badge}</span>}
                {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="app-sidebar no-print">
        <div className="app-sidebar-brand">
          <div className="app-brand-mark">GC</div>
          <div>
            <div className="app-brand-title">Gestione Congregazione</div>
            <div className="app-brand-subtitle">Pianificazione e incarichi</div>
          </div>
        </div>
        {navContent}
        <div className="app-sidebar-footer">Dati sincronizzati sul cloud</div>
      </aside>

      <div className="app-mobile-nav no-print">
        <div className="flex items-center gap-2 min-w-0">
          <div className="app-brand-mark compact">GC</div>
          <div className="font-semibold text-slate-900 truncate">Gestione Congregazione</div>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Chiudi menu' : 'Apri menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="app-mobile-menu no-print">
          <button className="app-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Chiudi menu" />
          <div className="app-mobile-panel">{navContent}</div>
        </div>
      )}
    </>
  );
};
