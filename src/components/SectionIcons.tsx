import {
  createLucideIcon,
  Users,
  Calendar,
  Clock,
  BarChart2,
  LucideIcon,
} from 'lucide-react';

/**
 * 1. Oratore sul podio stilizzato (Adunanza Domenica)
 * Discorso pubblico: oratore al podio/leggio con microfono e appunti
 */
export const SpeakerPodiumIcon: LucideIcon = createLucideIcon('SpeakerPodium', [
  // Testa dell'oratore
  ['circle', { cx: '12', cy: '4.5', r: '2.5', key: 'orator-head' }],
  // Spalle / busto
  ['path', { d: 'M8.5 11a3.5 3.5 0 0 1 7 0', key: 'orator-torso' }],
  // Piano inclinato del podio / leggio
  ['path', { d: 'M4 11.5h16l-1.5 3.5H5.5z', key: 'lectern-desk' }],
  // Asta microfono rivolta verso l'oratore
  ['path', { d: 'M16.5 11.5l1.5-2.5', key: 'lectern-mic' }],
  // Montanti e colonna centrale del podio
  ['path', { d: 'M9.5 15v5.5', key: 'lectern-col-l' }],
  ['path', { d: 'M14.5 15v5.5', key: 'lectern-col-r' }],
  // Base del podio
  ['path', { d: 'M7 21h10', key: 'lectern-base' }],
]);

/**
 * 2. Due donne sedute al tavolo che parlano (Vita e ministero)
 * Esercitazione studentesse: due sorelle sedute al tavolo per la dimostrazione
 */
export const WomenTableDiscussionIcon: LucideIcon = createLucideIcon('WomenTableDiscussion', [
  // Donna a sinistra seduta
  ['circle', { cx: '5', cy: '6', r: '2', key: 'w1-head' }],
  ['path', { d: 'M2.5 17v-4a2.5 2.5 0 0 1 4-2', key: 'w1-body' }],
  ['path', { d: 'M2.5 13.5v6.5', key: 'w1-chair' }],
  // Donna a destra seduta
  ['circle', { cx: '19', cy: '6', r: '2', key: 'w2-head' }],
  ['path', { d: 'M21.5 17v-4a2.5 2.5 0 0 0-4-2', key: 'w2-body' }],
  ['path', { d: 'M21.5 13.5v6.5', key: 'w2-chair' }],
  // Tavolo centrale tra le due
  ['path', { d: 'M5.5 13.5h13', key: 'table-top' }],
  ['path', { d: 'M8.5 13.5v6.5', key: 'table-leg-l' }],
  ['path', { d: 'M15.5 13.5v6.5', key: 'table-leg-r' }],
  // Bibbia/pubblicazione aperta sul tavolo
  ['path', { d: 'M10 13.5l2-1 2 1', key: 'open-bible' }],
  // Fumetto di dialogo (che parlano)
  ['path', { d: 'M9.5 5h5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-1.5L11 10v-1.5H9.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', key: 'speech-bubble' }],
]);

/**
 * 3. Uomo elegante con borsa (Servizio di campo)
 * Proclamatore elegante in giacca e cravatta con borsa delle testimonianze
 */
export const PreacherManWithBagIcon: LucideIcon = createLucideIcon('PreacherManWithBag', [
  // Testa dell'uomo
  ['circle', { cx: '9.5', cy: '4.5', r: '2.5', key: 'man-head' }],
  // Giacca elegante e spalle
  ['path', { d: 'M6 21v-7.5a2.5 2.5 0 0 1 2.5-2.5h2a2.5 2.5 0 0 1 2.5 2.5v7.5', key: 'suit-jacket' }],
  // Cravatta elegante
  ['path', { d: 'M9.5 11v3.5l-.8-1h1.6z', key: 'necktie' }],
  // Gambe / pantaloni
  ['path', { d: 'M7.5 21v-3', key: 'pants-l' }],
  ['path', { d: 'M11.5 21v-3', key: 'pants-r' }],
  // Braccio che impugna la borsa
  ['path', { d: 'M13 12.5l2.5 2', key: 'arm' }],
  // Borsa delle testimonianze / valigetta
  ['rect', { x: '15.5', y: '14', width: '7', height: '6', rx: '1', key: 'field-bag' }],
  ['path', { d: 'M17.5 14v-1.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5', key: 'bag-handle' }],
]);

/**
 * 4. Due donne con carrello pubblicazioni (Opera pubblica)
 * Espositore mobile / carrello con due proclamatrici a fianco
 */
export const WomenWithLiteratureCartIcon: LucideIcon = createLucideIcon('WomenWithLiteratureCart', [
  // Carrello / espositore mobile sulla sinistra
  ['rect', { x: '2.5', y: '5', width: '6', height: '12', rx: '1', key: 'cart-frame' }],
  // Ripiani esposizione pubblicazioni
  ['path', { d: 'M3.5 8.5h4', key: 'cart-shelf-1' }],
  ['path', { d: 'M3.5 12.5h4', key: 'cart-shelf-2' }],
  // Ruote del carrello mobile
  ['circle', { cx: '3.5', cy: '19', r: '1.2', key: 'cart-wheel-l' }],
  ['circle', { cx: '7.5', cy: '19', r: '1.2', key: 'cart-wheel-r' }],
  // Manico per il trasporto del carrello
  ['path', { d: 'M5.5 5V3a1 1 0 0 1 1-1h1', key: 'cart-handle' }],
  // Prima donna accanto al carrello
  ['circle', { cx: '12', cy: '5.5', r: '2', key: 'woman1-head' }],
  ['path', { d: 'M10.5 21v-7a1.8 1.8 0 0 1 3.2 0v7', key: 'woman1-dress' }],
  // Seconda donna a fianco
  ['circle', { cx: '18.5', cy: '5.5', r: '2', key: 'woman2-head' }],
  ['path', { d: 'M17 21v-7a1.8 1.8 0 0 1 3.2 0v7', key: 'woman2-dress' }],
]);

// Re-export delle icone standard per le altre sezioni
export { Users, Calendar, Clock, BarChart2 };
