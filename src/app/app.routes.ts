import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/pages/login/login';
import { HomeComponent } from './features/home/pages/home/home';
import { AgendarComponent } from './features/main/pages/agendar/agendar';
import { CalendarComponent } from './features/main/pages/calendar/calendar';
import { CadastroComponent } from './features/auth/pages/cadastro/cadastro';
import { ServicosComponent } from './features/main/pages/servicos/servicos';
import { DashboardComponent } from './features/main/pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'cadastro', component: CadastroComponent },
  { path: 'home', component: HomeComponent },
  { path: 'calendar', component: CalendarComponent},
  { path: 'agendamentos/:data', component: AgendarComponent},
  { path: 'servicos', component: ServicosComponent},
  { path: 'dashboard', component: DashboardComponent}

];
