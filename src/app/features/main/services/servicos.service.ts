import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { NovoServico, Servico } from '../models/servico.model';

@Injectable({ providedIn: 'root' })
export class ServicosService {
  private readonly firestore = inject(Firestore);

  async listarAtivos(idUsuario: string): Promise<Servico[]> {
    const servicos = await this.listarTodos(idUsuario);
    return servicos.filter(servico => servico.ativo);
  }

  async listarTodos(idUsuario: string): Promise<Servico[]> {
    const servicosRef = collection(this.firestore, 'servicos');
    const consulta = query(servicosRef, where('id_usuario', '==', idUsuario));
    const resultado = await getDocs(consulta);

    return resultado.docs
      .map(documento => {
        const dados = documento.data();

        return {
          id: documento.id,
          nome: String(dados['nome'] ?? ''),
          valorCentavos: Number(dados['valorCentavos'] ?? 0),
          duracaoMinutos:
            typeof dados['duracaoMinutos'] === 'number'
              ? dados['duracaoMinutos']
              : null,
          ativo: dados['ativo'] !== false,
          criadoEm: dados['criadoEm'] instanceof Timestamp
            ? dados['criadoEm']
            : undefined
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async cadastrar(idUsuario: string, novoServico: NovoServico): Promise<Servico> {
    const dadosParaSalvar = {
      id_usuario: idUsuario,
      nome: novoServico.nome,
      valorCentavos: novoServico.valorCentavos,
      duracaoMinutos: novoServico.duracaoMinutos,
      ativo: true,
      criadoEm: serverTimestamp()
    };

    const documento = await addDoc(
      collection(this.firestore, 'servicos'),
      dadosParaSalvar
    );

    return {
      id: documento.id,
      ...novoServico,
      ativo: true
    };
  }

  async desativar(idServico: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'servicos', idServico), {
      ativo: false,
      atualizadoEm: serverTimestamp()
    });
  }
}
