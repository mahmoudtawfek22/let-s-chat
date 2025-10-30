import { Routes } from '@angular/router';
import { LoginComponent } from './components/login-component/login-component';
import { ProfileComponent } from './components/profile-component/profile-component';
import { ChatComponent } from './components/chat/chat.component';
import { authGuard } from './guards/auth-guard';
import { notAuthGuard } from './guards/not-auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/chat',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [notAuthGuard],
  },
  {
    path: 'chat',
    component: ChatComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
  },
];
