
import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { AtmMenu } from './pages/atm-menu/atm-menu';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'register', component: Register },
  { path: 'atm-menu', component: AtmMenu },
  { path: '**', redirectTo: '' }
];
