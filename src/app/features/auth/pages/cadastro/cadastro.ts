import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  Auth,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut
} from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { environment } from '../../../../../environments/environment';

import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    FloatLabelModule,
    ButtonModule,
    ToastModule
  ],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.css',
  providers: [MessageService]
})
export class CadastroComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  loading = false;

  readonly cadastroForm = this.formBuilder.group({
    usuario: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [
      Validators.required,
      Validators.minLength(environment.useFirebaseAuthentication ? 6 : 3)
    ]]
  });

  async onSubmit(): Promise<void> {
    if (this.cadastroForm.invalid) {
      this.cadastroForm.markAllAsTouched();

      if (this.cadastroForm.controls.email.invalid) {
        this.exibirErro('Digite um endereço de e-mail válido.');
      } else if (this.cadastroForm.controls.senha.invalid) {
        const minimo = environment.useFirebaseAuthentication ? 6 : 3;
        this.exibirErro(`A senha deve ter pelo menos ${minimo} caracteres.`);
      } else {
        this.exibirErro('Preencha corretamente todos os campos.');
      }

      return;
    }

    const { usuario, email, senha } = this.cadastroForm.getRawValue();
    const nomeNormalizado = (usuario ?? '').trim().toLowerCase();
    const emailNormalizado = (email ?? '').trim().toLowerCase();

    this.loading = true;
    this.messageService.clear('cadastro');

    try {
      const usuariosRef = collection(this.firestore, 'usuarios');

      const [usuarioExistente, emailExistente] = await Promise.all([
        getDocs(query(usuariosRef, where('nome', '==', nomeNormalizado))),
        getDocs(query(usuariosRef, where('email', '==', emailNormalizado)))
      ]);

      if (!usuarioExistente.empty) {
        this.exibirErro('Esse nome de usuário já está em uso.');
        return;
      }

      if (!emailExistente.empty) {
        this.exibirErro('Esse e-mail já está cadastrado.');
        return;
      }

      if (environment.useFirebaseAuthentication) {
        const credencial = await createUserWithEmailAndPassword(
          this.auth,
          emailNormalizado,
          senha ?? ''
        );

        try {
          await setDoc(doc(this.firestore, 'usuarios', credencial.user.uid), {
            nome: nomeNormalizado,
            email: emailNormalizado
          });
        } catch (error) {
          // Evita deixar uma conta sem perfil caso a gravação no Firestore falhe.
          await deleteUser(credencial.user);
          throw error;
        }

        // O Firebase conecta automaticamente após criar a conta. Neste fluxo,
        // o usuário deve voltar ao login para entrar com o nome de usuário.
        await signOut(this.auth);
      } else {
        // Fluxo legado temporário para não interromper a usuária em produção.
        await addDoc(usuariosRef, {
          nome: nomeNormalizado,
          email: emailNormalizado,
          senha
        });
      }

      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Erro ao cadastrar usuário:', error);
      this.exibirErro(this.obterMensagemDeErro(error));
    } finally {
      this.loading = false;
    }
  }

  private exibirErro(mensagem: string): void {
    this.messageService.clear('cadastro');
    this.messageService.add({
      key: 'cadastro',
      severity: 'warn',
      summary: 'Atenção',
      detail: mensagem,
      life: 4000
    });
  }

  private obterMensagemDeErro(error: unknown): string {
    const codigo = (error as { code?: string })?.code;

    if (codigo === 'auth/email-already-in-use') {
      return 'Esse e-mail já está cadastrado.';
    }

    if (codigo === 'auth/weak-password') {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }

    return 'Não foi possível realizar o cadastro. Tente novamente.';
  }
}
