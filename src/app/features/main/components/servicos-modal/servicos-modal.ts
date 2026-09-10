import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { NovoServico } from '../../models/servico.model';

@Component({
  selector: 'app-servicos-modal',
  standalone: true,
  imports: [DialogModule, ReactiveFormsModule],
  templateUrl: './servicos-modal.html',
  styleUrl: './servicos-modal.css'
})
export class ServicosModalComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input() visible = false;
  @Input() salvando = false;
  @Input() erroAoSalvar = '';
  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly salvar = new EventEmitter<NovoServico>();

  erroFormulario = '';

  readonly servicoForm = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    valor: ['', Validators.required],
    duracao: ['']
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && !this.visible) {
      this.limparCampos();
    }
  }

  salvarServico(): void {
    this.erroFormulario = '';

    if (this.servicoForm.invalid) {
      this.servicoForm.markAllAsTouched();
      this.erroFormulario = 'Preencha o nome e o valor do serviço.';
      return;
    }

    const { nome, valor, duracao } = this.servicoForm.getRawValue();
    const valorCentavos = this.converterValorParaCentavos(valor);
    const duracaoMinutos = duracao === '' ? null : Number(duracao);

    if (!nome.trim()) {
      this.erroFormulario = 'Informe o nome do serviço.';
      return;
    }

    if (valorCentavos === null || valorCentavos <= 0) {
      this.erroFormulario = 'Informe um valor válido maior que zero.';
      return;
    }

    if (
      duracaoMinutos !== null &&
      (!Number.isInteger(duracaoMinutos) || duracaoMinutos <= 0)
    ) {
      this.erroFormulario = 'A duração deve ser informada em minutos inteiros.';
      return;
    }

    this.salvar.emit({
      nome: nome.trim(),
      valorCentavos,
      duracaoMinutos
    });
  }

  fechar(): void {
    this.limparCampos();
    this.visibleChange.emit(false);
  }

  aoAlterarVisibilidade(visible: boolean): void {
    if (!visible) {
      this.limparCampos();
    }

    this.visibleChange.emit(visible);
  }

  private limparCampos(): void {
    this.servicoForm.reset();
    this.erroFormulario = '';
  }

  private converterValorParaCentavos(valorDigitado: string): number | null {
    let valorNormalizado = valorDigitado.trim().replace(/R\$|\s/gi, '');

    if (valorNormalizado.includes(',')) {
      valorNormalizado = valorNormalizado.replace(/\./g, '').replace(',', '.');
    }

    const valorNumerico = Number(valorNormalizado);

    if (!Number.isFinite(valorNumerico)) {
      return null;
    }

    return Math.round(valorNumerico * 100);
  }
}
