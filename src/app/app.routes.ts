import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'kontakte',
    pathMatch: 'full',
  },
  {
    path: 'verbinden',
    loadComponent: () => import('./features/verbinden/verbinden.page').then((m) => m.VerbindenPage),
  },
  {
    path: 'name',
    loadComponent: () => import('./features/name/name.page').then((m) => m.NamePage),
  },
  {
    path: 'kontakte',
    loadComponent: () => import('./features/kontakte/kontakte.page').then((m) => m.KontaktePage),
  },
  {
    path: 'kontakte/neu',
    loadComponent: () => import('./features/handshake/handshake.page').then((m) => m.HandshakePage),
  },
  {
    path: 'kontakte/neu/fertig/:contactId',
    loadComponent: () => import('./features/handshake/kontakt-benennen.page').then((m) => m.KontaktBenennenPage),
  },
  {
    path: 'chat/:contactId',
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  {
    path: 'chat/:contactId/standort/:messageId',
    loadComponent: () => import('./features/standort/standort.page').then((m) => m.StandortPage),
  },
  {
    path: 'gruppe/neu',
    loadComponent: () => import('./features/gruppe/gruppe-neu.page').then((m) => m.GruppeNeuPage),
  },
  {
    path: 'gruppe/:groupId',
    loadComponent: () => import('./features/gruppe/gruppe-chat.page').then((m) => m.GruppeChatPage),
  },
  {
    path: 'einstellungen',
    loadComponent: () => import('./features/einstellungen/einstellungen.page').then((m) => m.EinstellungenPage),
  },
  {
    path: 'einstellungen/export',
    loadComponent: () => import('./features/einstellungen/export.page').then((m) => m.ExportPage),
  },
  {
    path: 'einstellungen/import',
    loadComponent: () => import('./features/einstellungen/import.page').then((m) => m.ImportPage),
  },
];
