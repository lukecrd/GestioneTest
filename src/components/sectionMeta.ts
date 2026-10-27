import React from 'react';
import { Users, Calendar, Clock, BarChart2, LayoutDashboard, Map as MapIcon, Megaphone, UserCog, ClipboardList } from 'lucide-react';
import { SpeakerPodiumIcon, WomenTableDiscussionIcon, PreacherManWithBagIcon, WomenWithLiteratureCartIcon } from './SectionIcons';
import type { SectionKey } from './ModernSectionHub';

// Colore e icona di ogni sezione: unica fonte per barra laterale, barra in alto e Dashboard.
// Ogni colore regge il testo bianco con contrasto >= 5:1 (verificato); verde/ambra/rosso di stato restano agli avvisi.
export const SECTION_META: Record<SectionKey | 'hub', { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  hub: { color: '#2e5148', icon: LayoutDashboard },
  tabella: { color: '#0b5563', icon: ClipboardList },
  anagrafica: { color: '#1864ab', icon: Users },
  mensile: { color: '#0b7285', icon: Calendar },
  domenica: { color: '#5f3dc4', icon: SpeakerPodiumIcon },
  vitaEMinistero: { color: '#862e9c', icon: WomenTableDiscussionIcon },
  discorsiEsterni: { color: '#a61e4d', icon: Megaphone },
  servizioCampo: { color: '#c2410c', icon: PreacherManWithBagIcon },
  operaPubblica: { color: '#8a5a00', icon: WomenWithLiteratureCartIcon },
  territori: { color: '#2b7a3b', icon: MapIcon },
  impostazioni: { color: '#4c5a6b', icon: Clock },
  statistiche: { color: '#3b4cca', icon: BarChart2 },
  utenti: { color: '#7a4b12', icon: UserCog },
};

// Da usare come style: espone il colore alle regole CSS (.app-nav-icon, .module-icon, …).
export const accentStyle = (section: SectionKey | 'hub', varName = '--accent') =>
  ({ [varName]: SECTION_META[section].color }) as React.CSSProperties;
