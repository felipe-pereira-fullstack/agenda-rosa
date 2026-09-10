import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { environment } from '../../../../../environments/environment';

import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { EsqueciSenhaModalComponent } from '../../components/esqueci-senha-modal/esqueci-senha-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    FloatLabelModule,
    ToastModule,
    EsqueciSenhaModalComponent
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  providers: [MessageService]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading: boolean = false;
  modalRecuperacaoVisivel = false;
  readonly recuperacaoDisponivel = environment.useFirebaseAuthentication;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private messageService = inject(MessageService);

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      usuario: ['', Validators.required],
      senha: ['', Validators.required]
    });
  }

  ngOnInit() {
    if (localStorage.getItem('usuarioLogado')) {
      this.router.navigate(['/home']);
    }
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.loading = true;
      this.messageService.clear('login');
      const { usuario, senha } = this.loginForm.value;
      const nomeNormalizado = usuario.trim().toLowerCase();

      try {
        const usuariosRef = collection(this.firestore, 'usuarios');
        const q = environment.useFirebaseAuthentication
          ? query(usuariosRef, where('nome', '==', nomeNormalizado))
          : query(
              usuariosRef,
              where('nome', '==', nomeNormalizado),
              where('senha', '==', senha)
            );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          this.exibirCredenciaisInvalidas();
          return;
        }

        const usuarioEncontrado = querySnapshot.docs[0];
        const dadosUsuario = usuarioEncontrado.data();
        let idUsuario = usuarioEncontrado.id;

        if (environment.useFirebaseAuthentication) {
          const email = dadosUsuario['email'];

          if (typeof email !== 'string' || !email) {
            this.exibirCredenciaisInvalidas();
            return;
          }

          const credencial = await signInWithEmailAndPassword(
            this.auth,
            email,
            senha
          );

          idUsuario = credencial.user.uid;
        }

        localStorage.setItem('usuarioLogado', JSON.stringify({
          id: idUsuario,
          nome: dadosUsuario['nome'],
          nomeCompleto: dadosUsuario['nomeCompleto'] || dadosUsuario['nome']
        }));

        this.messageService.clear('login');
        await this.router.navigate(['/home']);
      } catch (error) {
        console.error('Erro ao autenticar usuário:', error);
        this.exibirCredenciaisInvalidas();
      } finally {
        this.loading = false;
      }
    } else {
      this.loginForm.markAllAsTouched();
      this.exibirAviso();
    }
  }

  abrirRecuperacao(): void {
    this.modalRecuperacaoVisivel = true;
  }

  private exibirAviso(): void {
    this.messageService.clear('login');
    this.messageService.add({
      key: 'login',
      severity: 'warn',
      summary: 'Atenção',
      detail: 'Preencha os campos corretamente',
      life: 4000
    });
  }

  private exibirCredenciaisInvalidas(): void {
    this.messageService.clear('login');
    this.messageService.add({
      key: 'login',
      severity: 'warn',
      summary: 'Atenção',
      detail: 'Usuário ou senha inválidos.',
      life: 4000
    });
  }
}
