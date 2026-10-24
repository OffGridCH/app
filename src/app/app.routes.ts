import { Routes } from '@angular/router';

import { onboardingGuard } from './core/onboarding.guard';

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
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/kontakte/kontakte.page').then((m) => m.KontaktePage),
  },
  {
    path: 'kontakte/neu',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/handshake/handshake.page').then((m) => m.HandshakePage),
  },
  {
    path: 'kontakte/neu/fertig/:contactId',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/handshake/kontakt-benennen.page').then((m) => m.KontaktBenennenPage),
  },
  {
    path: 'chat/:contactId',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  {
    path: 'chat/:contactId/standort/:messageId',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/standort/standort.page').then((m) => m.StandortPage),
  },
  {
    path: 'gruppe/neu',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/gruppe/gruppe-neu.page').then((m) => m.GruppeNeuPage),
  },
  {
    path: 'gruppe/:groupId',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/gruppe/gruppe-chat.page').then((m) => m.GruppeChatPage),
  },
  {
    path: 'einstellungen',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/einstellungen/einstellungen.page').then((m) => m.EinstellungenPage),
  },
  {
    path: 'einstellungen/export',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/einstellungen/export.page').then((m) => m.ExportPage),
  },
  {
    path: 'einstellungen/import',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/einstellungen/import.page').then((m) => m.ImportPage),
  },
];
