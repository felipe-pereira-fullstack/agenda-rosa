import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { environment } from '../../../../environments/environment';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MenuModule, ButtonModule, DialogModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  // Recebe o título da página que chamar o header
  @Input() titulo: string = 'Início'; 

  // Itens do menu hambúrguer
  menuItems: MenuItem[] | undefined;
  modalSaidaVisivel = false;
  saindo = false;
  erroSaida = '';

  constructor(
    private router: Router,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.menuItems = [
      {
        label: 'Sair',
        icon: 'pi pi-sign-out',
        command: () => this.abrirConfirmacaoSaida()
      }
    ];
  }

  abrirConfirmacaoSaida(): void {
    this.erroSaida = '';
    this.modalSaidaVisivel = true;
  }

  cancelarSaida(): void {
    if (this.saindo) {
      return;
    }

    this.modalSaidaVisivel = false;
    this.erroSaida = '';
  }

  aoAlterarVisibilidadeSaida(visible: boolean): void {
    if (!visible) {
      this.cancelarSaida();
    }
  }

  async confirmarSaida(): Promise<void> {
    if (this.saindo) {
      return;
    }

    this.saindo = true;
    this.erroSaida = '';

    try {
      if (environment.useFirebaseAuthentication) {
        await signOut(this.auth);
      }

      localStorage.removeItem('usuarioLogado');
      this.modalSaidaVisivel = false;
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      this.erroSaida = 'Não foi possível sair. Tente novamente.';
    } finally {
      this.saindo = false;
    }
  }

  irParaHome(): void {
    void this.router.navigate(['/home']);
  }
}
