import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Importações do Firebase Firestore
import { Firestore, collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';

// Importações do PrimeNG
import { DialogModule } from 'primeng/dialog';

// Seus componentes compartilhados
import { FooterComponent } from '../../../../shared/components/footer/footer';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { agendamentos, TableComponent } from '../../../../shared/components/table/table';
import { Servico } from '../../models/servico.model';
import { ServicosService } from '../../services/servicos.service';

@Component({
  selector: 'app-agendar',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    DialogModule, 
    HeaderComponent, 
    FooterComponent, 
    TableComponent,
  ],
  templateUrl: './agendar.html',
  styleUrls: ['./agendar.css']
})
export class AgendarComponent implements OnInit {
  mostrarModalAgendamento: boolean = false;
  tituloDataExtenso: string = '';
  dataAtualDaRota: string = '';
  agendamentosDoDia: any[] = [];
  servicosDisponiveis: Servico[] = [];
  carregandoServicos = true;
  agendamentoParaExcluir: any | null = null;
  excluindoAgendamento = false;
  erroExclusao = '';
  erroHorario = '';
  
  // Guarda o ID do agendamento sendo editado (null = criando novo)
  idAgendamentoEmEdicao: string | null = null;

  // Guardará o ID da pessoa que está usando o sistema agora
  idUsuarioLogado: string = '';

  novoAgendamento = {
    nome: '',
    hora: '',
    servicoId: ''
  };

  // Injetando Banco de Dados, Rotas e o Detetor de Mudanças
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private servicosService = inject(ServicosService);
  
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // 1. Verifica quem está logado
    const userJson = localStorage.getItem('usuarioLogado');
    if (!userJson) {
      this.router.navigate(['/login']);
      return;
    }
    this.idUsuarioLogado = JSON.parse(userJson).id;
    void this.buscarServicosDisponiveis();

    // 2. Pega a data da URL (ex: '2026-03-18')
    const dataUrl = this.route.snapshot.paramMap.get('data');
    if (dataUrl) {
      this.dataAtualDaRota = dataUrl;
      this.formatarData(dataUrl);
      
      // 3. Busca os dados no banco de dados para essa data
      this.buscarAgendamentosDaRota();
    }
  }

  async buscarServicosDisponiveis(): Promise<void> {
    this.carregandoServicos = true;

    try {
      this.servicosDisponiveis = await this.servicosService.listarAtivos(
        this.idUsuarioLogado
      );
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      this.servicosDisponiveis = [];
    } finally {
      this.carregandoServicos = false;
      this.cdr.detectChanges();
    }
  }

  // Vai no Firebase e busca APENAS os dessa pessoa e dessa data
  async buscarAgendamentosDaRota() {
    try {
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(agendamentosRef, 
        where('id_usuario', '==', this.idUsuarioLogado),
        where('data', '==', this.dataAtualDaRota)
      );
      
      const querySnapshot = await getDocs(q);
      const listaTemporaria: any[] = [];
      
      querySnapshot.forEach((doc) => {
        listaTemporaria.push({ id_firebase: doc.id, ...doc.data() });
      });
      
      // ORDENAÇÃO MATEMÁTICA POR MINUTOS TOTAIS
      this.agendamentosDoDia = listaTemporaria.sort((a, b) => {
        // Verifica se a hora existe para evitar erros
        if (!a.hora || !b.hora) return 0;

        const horaA = a.hora.split(':');
        const horaB = b.hora.split(':');
        
        // Transforma tudo em minutos
        const minutosA = horaA.length === 2 ? (parseInt(horaA[0]) * 60) + parseInt(horaA[1]) : 0;
        const minutosB = horaB.length === 2 ? (parseInt(horaB[0]) * 60) + parseInt(horaB[1]) : 0;
        
        // Menos minutos (mais cedo) ficam em cima
        return minutosA - minutosB;
      });

      // Força o Angular a atualizar a tabela imediatamente após receber os dados
      this.cdr.detectChanges();

    } catch (error) {
      console.error("Erro ao buscar agendamentos do banco:", error);
    }
  }

  formatarData(dataString: string) {
    const dataObj = new Date(dataString + 'T12:00:00'); 
    const diasSemana = ['Domingo', 'Segunda Feira', 'Terça Feira', 'Quarta Feira', 'Quinta Feira', 'Sexta Feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const diaSemana = diasSemana[dataObj.getDay()];
    const diaMes = dataObj.getDate();
    const mes = meses[dataObj.getMonth()];
    const ano = dataObj.getFullYear();

    this.tituloDataExtenso = `${diaSemana} - ${diaMes} de ${mes} de ${ano}`;
  }

  abrirModal() {
    // Garante que abre limpo (modo criação)
    this.idAgendamentoEmEdicao = null;
    this.limparFormulario();
    this.mostrarModalAgendamento = true;
  }

  // Abre o modal já preenchido com os dados do agendamento escolhido
  abrirModalEdicao(agendamento: any) {
    this.idAgendamentoEmEdicao = agendamento.id_firebase;
    const servicoCorrespondente = this.servicosDisponiveis.find(
      servico =>
        servico.id === agendamento.servicoId ||
        servico.nome === agendamento.servico
    );

    this.novoAgendamento = {
      nome: agendamento.nome,
      hora: agendamento.hora,
      servicoId: servicoCorrespondente?.id ?? ''
    };
    this.mostrarModalAgendamento = true;
  }

  cancelarAgendamento() {
    this.mostrarModalAgendamento = false;
    this.idAgendamentoEmEdicao = null;
    this.limparFormulario();
  }

  bloquearTeclaHorario(evento: KeyboardEvent): void {
    const teclasPermitidas = [
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'Shift',
      'Alt',
      'Control',
      'Meta'
    ];

    if (
      teclasPermitidas.includes(evento.key) ||
      evento.ctrlKey ||
      evento.metaKey ||
      /^\d$/.test(evento.key) ||
      evento.key === ':'
    ) {
      return;
    }

    evento.preventDefault();
    this.erroHorario = 'Digite o horário usando somente números e dois-pontos.';
  }

  aoDigitarHorario(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const valorAnterior = this.novoAgendamento.hora;
    let valor = input.value.replace(/[^\d:]/g, '');
    const possuiDoisPontos = valor.includes(':');

    if (!possuiDoisPontos && valor.length > 2) {
      valor = valor.slice(0, 2) + ':' + valor.slice(2, 4);
    } else {
      const [hora = '', minuto = ''] = valor.split(':');
      valor = hora.slice(0, 2);

      if (possuiDoisPontos) {
        valor += ':' + minuto.slice(0, 2);
      }
    }

    const [hora, minuto = ''] = valor.split(':');
    const numeroHora = hora.length === 2 ? Number(hora) : null;
    const numeroMinuto = minuto.length === 2 ? Number(minuto) : null;

    if (numeroHora !== null && numeroHora > 24) {
      input.value = valorAnterior;
      this.erroHorario = 'A hora não pode ser maior que 24.';
      return;
    }

    if (numeroMinuto !== null && numeroMinuto > 59) {
      input.value = valorAnterior;
      this.erroHorario = 'Os minutos não podem ser maiores que 59.';
      return;
    }

    if (numeroHora === 24 && minuto !== '' && Number(minuto) > 0) {
      input.value = valorAnterior;
      this.erroHorario = 'O horário máximo permitido é 24:00.';
      return;
    }

    this.novoAgendamento.hora = valor;
    input.value = valor;
    this.erroHorario = '';
  }

  normalizarHorario(mostrarErroObrigatorio = true): boolean {
    const valor = this.novoAgendamento.hora.trim();

    if (!valor) {
      this.erroHorario = mostrarErroObrigatorio
        ? 'Informe o horário do agendamento.'
        : '';
      return false;
    }

    const [horaDigitada, minutoDigitado = ''] = valor.split(':');
    const hora = Number(horaDigitada);
    const minuto = minutoDigitado === '' ? 0 : Number(minutoDigitado);

    if (
      !/^\d{1,2}$/.test(horaDigitada) ||
      (minutoDigitado !== '' && !/^\d{1,2}$/.test(minutoDigitado))
    ) {
      this.erroHorario = 'Informe um horário válido.';
      return false;
    }

    if (hora > 24) {
      this.erroHorario = 'A hora não pode ser maior que 24.';
      return false;
    }

    if (minuto > 59) {
      this.erroHorario = 'Os minutos não podem ser maiores que 59.';
      return false;
    }

    if (hora === 24 && minuto > 0) {
      this.erroHorario = 'O horário máximo permitido é 24:00.';
      return false;
    }

    this.novoAgendamento.hora =
      String(hora).padStart(2, '0') + ':' + String(minuto).padStart(2, '0');
    this.erroHorario = '';
    return true;
  }

  aoAlterarVisibilidadeModal(visible: boolean): void {
    if (!visible) {
      this.cancelarAgendamento();
      return;
    }

    this.mostrarModalAgendamento = true;
  }

  // Salva ou Atualiza no Banco de Dados e fecha o modal imediatamente
  async salvarAgendamento() {
  if (!this.normalizarHorario()) {
    return;
  }

  const servicoSelecionado = this.servicosDisponiveis.find(
    servico => servico.id === this.novoAgendamento.servicoId
  );

  if (this.novoAgendamento.nome && this.novoAgendamento.hora && servicoSelecionado) {
    this.mostrarModalAgendamento = false;
    this.cdr.detectChanges();

    try {
      if (this.idAgendamentoEmEdicao) {
        const idEditando = this.idAgendamentoEmEdicao;

        const docRef = doc(this.firestore, 'agendamentos', idEditando);
        await updateDoc(docRef, {
          nome: this.novoAgendamento.nome,
          hora: this.novoAgendamento.hora,
          servicoId: servicoSelecionado.id,
          servico: servicoSelecionado.nome,
          valorServicoCentavos: servicoSelecionado.valorCentavos
        });

        const index = this.agendamentosDoDia.findIndex(
          item => item.id_firebase === idEditando
        );

        if (index !== -1) {
          this.agendamentosDoDia[index] = {
            ...this.agendamentosDoDia[index],
            nome: this.novoAgendamento.nome,
            hora: this.novoAgendamento.hora,
            servicoId: servicoSelecionado.id,
            servico: servicoSelecionado.nome,
            valorServicoCentavos: servicoSelecionado.valorCentavos
          };

          this.agendamentosDoDia = [...this.agendamentosDoDia].sort((a, b) => {
            if (!a.hora || !b.hora) return 0;

            const horaA = a.hora.split(':');
            const horaB = b.hora.split(':');

            const minutosA = horaA.length === 2 ? (parseInt(horaA[0]) * 60) + parseInt(horaA[1]) : 0;
            const minutosB = horaB.length === 2 ? (parseInt(horaB[0]) * 60) + parseInt(horaB[1]) : 0;

            return minutosA - minutosB;
          });
        }

        this.cdr.detectChanges();
      } else {
        const agendamentoParaSalvar = {
          nome: this.novoAgendamento.nome,
          hora: this.novoAgendamento.hora,
          servicoId: servicoSelecionado.id,
          servico: servicoSelecionado.nome,
          valorServicoCentavos: servicoSelecionado.valorCentavos,
          data: this.dataAtualDaRota,
          id_usuario: this.idUsuarioLogado
        };

        await addDoc(collection(this.firestore, 'agendamentos'), agendamentoParaSalvar);
        await this.buscarAgendamentosDaRota();
      }

      this.idAgendamentoEmEdicao = null;
      this.limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar no banco: ', error);
      alert('Erro ao salvar o agendamento.');
      this.mostrarModalAgendamento = true;
      this.cdr.detectChanges();
    }
  }
}

  limparFormulario() {
    this.novoAgendamento = { nome: '', hora: '', servicoId: '' };
    this.erroHorario = '';
  }

  removerDaLista(agendamento: any): void {
    this.erroExclusao = '';
    this.agendamentoParaExcluir = agendamento;
  }

  cancelarExclusao(): void {
    if (this.excluindoAgendamento) {
      return;
    }

    this.agendamentoParaExcluir = null;
    this.erroExclusao = '';
  }

  aoAlterarVisibilidadeExclusao(visible: boolean): void {
    if (!visible) {
      this.cancelarExclusao();
    }
  }

  async confirmarExclusao(): Promise<void> {
    const agendamento = this.agendamentoParaExcluir;

    if (!agendamento?.id_firebase || this.excluindoAgendamento) {
      return;
    }

    this.excluindoAgendamento = true;
    this.erroExclusao = '';

    try {
      await deleteDoc(
        doc(this.firestore, 'agendamentos', agendamento.id_firebase)
      );
      this.agendamentoParaExcluir = null;
      await this.buscarAgendamentosDaRota();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      this.erroExclusao = 'Não foi possível excluir. Tente novamente.';
    } finally {
      this.excluindoAgendamento = false;
      this.cdr.detectChanges();
    }
  }
}
