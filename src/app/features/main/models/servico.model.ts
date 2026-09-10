import { Timestamp } from '@angular/fire/firestore';

export interface Servico {
  id: string;
  nome: string;
  valorCentavos: number;
  duracaoMinutos: number | null;
  ativo: boolean;
  criadoEm?: Timestamp;
}

export interface NovoServico {
  nome: string;
  valorCentavos: number;
  duracaoMinutos: number | null;
}
