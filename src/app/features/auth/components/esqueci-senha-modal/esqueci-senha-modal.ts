import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-esqueci-senha-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule
  ],
  templateUrl: './esqueci-senha-modal.html',
  styleUrl: './esqueci-senha-modal.css'
})
export class EsqueciSenhaModalComponent {
  private readonly auth = inject(Auth);
  private readonly formBuilder = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Output() readonly visibleChange = new EventEmitter<boolean>();

  readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  loading = false;
  emailEnviado = false;
  tentouEnviar = false;
  mensagemErro = '';

  async enviarLink(): Promise<void> {
    this.tentouEnviar = true;

    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.mensagemErro = '';

    try {
      this.auth.languageCode = 'pt-BR';
      const email = this.emailForm.controls.email.value.trim().toLowerCase();

      await sendPasswordResetEmail(this.auth, email);
      this.emailEnviado = true;
    } catch (error) {
      const codigo = (error as { code?: string })?.code;

      // A resposta é neutra para não revelar quais e-mails estão cadastrados.
      if (codigo === 'auth/user-not-found') {
        this.emailEnviado = true;
      } else if (codigo === 'auth/too-many-requests') {
        this.mensagemErro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      } else {
        console.error('Erro ao enviar o e-mail de recuperação:', error);
        this.mensagemErro = 'Não foi possível enviar o link agora. Tente novamente.';
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  fechar(): void {
    if (this.loading) {
      return;
    }

    this.visibleChange.emit(false);
    this.emailForm.reset();
    this.emailEnviado = false;
    this.tentouEnviar = false;
    this.mensagemErro = '';
  }

  aoAlterarVisibilidade(visible: boolean): void {
    if (!visible) {
      this.fechar();
    }
  }
}
