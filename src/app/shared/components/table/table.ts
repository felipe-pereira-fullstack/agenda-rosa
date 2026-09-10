import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
 
export interface agendamentos {
  nome: string;
  hora: string;
  servico: string;
  data: string;
}
 
@Component({
  selector: 'app-agendamentos-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './table.html',
  styleUrls: ['./table.css']
})
export class TableComponent {
  @Input() agendamentos: agendamentos[] = [];
  @Input() mostrarAcoes: boolean = true;
  @Input() vazioDestacado: boolean = false;
 
  @Output() onDeletar = new EventEmitter<agendamentos>();
  @Output() onEditar = new EventEmitter<agendamentos>();
 
  clicouDeletar(agendamento: agendamentos) {
    this.onDeletar.emit(agendamento);
  }
 
  clicouEditar(agendamento: agendamentos) {
    this.onEditar.emit(agendamento);
  }
}
 
