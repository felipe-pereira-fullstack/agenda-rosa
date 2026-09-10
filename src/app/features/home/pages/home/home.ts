import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router'; 
import { HeaderComponent } from '../../../../shared/components/header/header';
import { FooterComponent } from '../../../../shared/components/footer/footer';
import { TableComponent } from '../../../../shared/components/table/table';
import { MiniCalendarComponent } from '../../../../shared/components/mini-calendar/mini-calendar';

// Importações do Firebase Firestore
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent, FooterComponent, TableComponent, MiniCalendarComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent implements OnInit {

  diaAtual = '';
  agendamentosDoDia: any[] = [];
  nomeDoUsuario: string = '';

  // Injetando o Firestore direto no componente de Home
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  constructor(private router: Router) {}

  ngOnInit() {
    // 1. Verifica quem está logado
    const userJson = localStorage.getItem('usuarioLogado');
    
    if (!userJson) {
      // Se ninguém estiver logado, expulsa para a tela de login
      this.router.navigate(['/login']);
      return;
    }

    // Pega os dados do usuário (ID e Nome)
    const usuarioLogado = JSON.parse(userJson);
    this.nomeDoUsuario = usuarioLogado.nomeCompleto || usuarioLogado.nome;

    // 2. Pegar a data de hoje formatada como 'YYYY-MM-DD'
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const hojeFormatado = `${ano}-${mes}-${dia}`;
    
    this.diaAtual = String(hoje.getDate());

    // 3. Busca os agendamentos reais lá no banco de dados para ESSA pessoa
    this.buscarAgendamentosDoBanco(usuarioLogado.id, hojeFormatado);
  }

  // Função assíncrona que vai no Firebase buscar os dados
  async buscarAgendamentosDoBanco(idUsuario: string, dataDeHoje: string) {
    try {
      console.log(`Buscando agendamentos para o ID: ${idUsuario} na data: ${dataDeHoje}`);
      
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      
      // MÁGICA AQUI: Traz onde o id_usuario é igual a quem logou E a data é igual a hoje
      const q = query(agendamentosRef, 
        where('id_usuario', '==', idUsuario),
        where('data', '==', dataDeHoje)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Limpa a lista antes de preencher
      const listaTemporaria: any[] = [];
      
      querySnapshot.forEach((doc) => {
        // Para cada agendamento que vier do banco, coloca na lista
        listaTemporaria.push({ id: doc.id, ...doc.data() });
      });
      
      // ORDENAÇÃO MATEMÁTICA POR MINUTOS TOTAIS
      this.agendamentosDoDia = listaTemporaria.sort((a, b) => {
        // Verifica se a hora existe para evitar erros
        if (!a.hora || !b.hora) return 0;

        const horaA = a.hora.split(':');
        const horaB = b.hora.split(':');
        
        // Transforma tudo em minutos (ex: 8h * 60 + 30 = 510 minutos)
        const minutosA = horaA.length === 2 ? (parseInt(horaA[0]) * 60) + parseInt(horaA[1]) : 0;
        const minutosB = horaB.length === 2 ? (parseInt(horaB[0]) * 60) + parseInt(horaB[1]) : 0;
        
        // Coloca o menor número (mais cedo) primeiro
        return minutosA - minutosB;
      });
      
      // FORÇA A TABELA A ATUALIZAR NA TELA
      this.cdr.detectChanges(); 
      
      console.log("Agendamentos carregados e ordenados matematicamente: ", this.agendamentosDoDia);

    } catch (error) {
      console.error("Erro ao buscar agendamentos no Firebase:", error);
    }
  }
}
