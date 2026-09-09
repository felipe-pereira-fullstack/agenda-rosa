import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where
} from '@angular/fire/firestore';
import { FooterComponent } from '../../../../shared/components/footer/footer';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { ServicosService } from '../../services/servicos.service';

type PeriodoDashboard = 'hoje' | 'semana' | 'mes' | 'ano';

interface AgendamentoDashboard {
  data: string;
  servico: string;
  servicoId?: string;
  valorServicoCentavos?: number;
}

interface ResumoServico {
  chave: string;
  nome: string;
  quantidade: number;
  totalCentavos: number;
  ativo: boolean;
  percentualQuantidade: number;
  percentualFaturamento: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, HeaderComponent, FooterComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly servicosService = inject(ServicosService);

  readonly periodos: Array<{ valor: PeriodoDashboard; label: string }> = [
    { valor: 'hoje', label: 'Hoje' },
    { valor: 'semana', label: 'Semana' },
    { valor: 'mes', label: 'Mês' },
    { valor: 'ano', label: 'Ano' }
  ];

  periodoSelecionado: PeriodoDashboard = 'mes';
  descricaoPeriodo = '';
  carregando = true;
  mensagemErro = '';
  totalFaturadoCentavos = 0;
  totalAtendimentos = 0;
  agendamentosSemValor = 0;
  resumoServicos: ResumoServico[] = [];

  private agendamentos: AgendamentoDashboard[] = [];
  private statusServicos = new Map<string, boolean>();

  ngOnInit(): void {
    const usuarioSalvo = localStorage.getItem('usuarioLogado');

    if (!usuarioSalvo) {
      void this.router.navigate(['/login']);
      return;
    }

    try {
      const usuario = JSON.parse(usuarioSalvo) as { id?: unknown };

      if (typeof usuario.id !== 'string' || !usuario.id) {
        throw new Error('Usuário salvo sem identificador.');
      }

      void this.carregarAgendamentos(usuario.id);
    } catch (error) {
      console.error('Erro ao identificar usuário logado:', error);
      localStorage.removeItem('usuarioLogado');
      void this.router.navigate(['/login']);
    }
  }

  selecionarPeriodo(periodo: PeriodoDashboard): void {
    this.periodoSelecionado = periodo;
    this.calcularResumo();
  }

  private async carregarAgendamentos(idUsuario: string): Promise<void> {
    this.carregando = true;
    this.mensagemErro = '';

    try {
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const consulta = query(
        agendamentosRef,
        where('id_usuario', '==', idUsuario)
      );
      const [resultado, servicos] = await Promise.all([
        getDocs(consulta),
        this.servicosService.listarTodos(idUsuario)
      ]);

      this.statusServicos = new Map(
        servicos.map(servico => [servico.id, servico.ativo])
      );

      this.agendamentos = resultado.docs
        .map(documento => {
          const dados = documento.data();

          return {
            data: String(dados['data'] ?? ''),
            servico: String(dados['servico'] ?? 'Serviço não informado'),
            servicoId:
              typeof dados['servicoId'] === 'string'
                ? dados['servicoId']
                : undefined,
            valorServicoCentavos:
              typeof dados['valorServicoCentavos'] === 'number'
                ? dados['valorServicoCentavos']
                : undefined
          };
        })
        .filter(agendamento => /^\d{4}-\d{2}-\d{2}$/.test(agendamento.data));

      this.calcularResumo();
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      this.mensagemErro = 'Não foi possível carregar os dados do dashboard.';
    } finally {
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }

  private calcularResumo(): void {
    const { inicio, fim } = this.obterIntervalo();
    const inicioFormatado = this.formatarDataBanco(inicio);
    const fimFormatado = this.formatarDataBanco(fim);
    const agendamentosDoPeriodo = this.agendamentos.filter(
      agendamento =>
        agendamento.data >= inicioFormatado &&
        agendamento.data <= fimFormatado
    );
    const agrupados = new Map<
      string,
      { nome: string; quantidade: number; totalCentavos: number; ativo: boolean }
    >();

    for (const agendamento of agendamentosDoPeriodo) {
      const chave =
        agendamento.servicoId ??
        agendamento.servico.trim().toLocaleLowerCase('pt-BR');
      const resumo = agrupados.get(chave) ?? {
        nome: agendamento.servico,
        quantidade: 0,
        totalCentavos: 0,
        ativo: agendamento.servicoId
          ? (this.statusServicos.get(agendamento.servicoId) ?? false)
          : true
      };

      resumo.quantidade += 1;
      resumo.totalCentavos += agendamento.valorServicoCentavos ?? 0;
      agrupados.set(chave, resumo);
    }

    const maiorQuantidade = Math.max(
      1,
      ...Array.from(agrupados.values(), item => item.quantidade)
    );
    const maiorFaturamento = Math.max(
      1,
      ...Array.from(agrupados.values(), item => item.totalCentavos)
    );

    this.totalAtendimentos = agendamentosDoPeriodo.length;
    this.totalFaturadoCentavos = agendamentosDoPeriodo.reduce(
      (total, agendamento) =>
        total + (agendamento.valorServicoCentavos ?? 0),
      0
    );
    this.agendamentosSemValor = agendamentosDoPeriodo.filter(
      agendamento => agendamento.valorServicoCentavos === undefined
    ).length;
    this.resumoServicos = Array.from(agrupados, ([chave, item]) => ({
      chave,
      ...item,
      percentualQuantidade: (item.quantidade / maiorQuantidade) * 100,
      percentualFaturamento: (item.totalCentavos / maiorFaturamento) * 100
    })).sort(
      (a, b) =>
        b.totalCentavos - a.totalCentavos || b.quantidade - a.quantidade
    );
    this.descricaoPeriodo = this.formatarDescricaoPeriodo(inicio, fim);
  }

  private obterIntervalo(): { inicio: Date; fim: Date } {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fim = new Date(inicio);

    if (this.periodoSelecionado === 'semana') {
      const diasDesdeSegunda = (inicio.getDay() + 6) % 7;
      inicio.setDate(inicio.getDate() - diasDesdeSegunda);
      fim.setTime(inicio.getTime());
      fim.setDate(inicio.getDate() + 6);
    } else if (this.periodoSelecionado === 'mes') {
      inicio.setDate(1);
      fim.setFullYear(inicio.getFullYear(), inicio.getMonth() + 1, 0);
    } else if (this.periodoSelecionado === 'ano') {
      inicio.setMonth(0, 1);
      fim.setFullYear(inicio.getFullYear(), 11, 31);
    }

    return { inicio, fim };
  }

  private formatarDataBanco(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return ano + '-' + mes + '-' + dia;
  }

  private formatarDescricaoPeriodo(inicio: Date, fim: Date): string {
    if (this.periodoSelecionado === 'hoje') {
      return inicio.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    if (this.periodoSelecionado === 'semana') {
      return (
        inicio.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short'
        }) +
        ' a ' +
        fim.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short'
        })
      );
    }

    if (this.periodoSelecionado === 'mes') {
      const descricao = inicio.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      });
      return descricao.charAt(0).toUpperCase() + descricao.slice(1);
    }

    return String(inicio.getFullYear());
  }
}
