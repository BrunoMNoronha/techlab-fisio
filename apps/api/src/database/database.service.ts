// TechLab Fisio — provider de persistência do backend (Etapa 2.3B).
//
// ÚNICO dono do cliente de persistência no processo da API:
//   - o cliente é criado EXCLUSIVAMENTE pela fábrica pública de
//     `@techlab-fisio/database` (o pacote é o proprietário do Prisma Client
//     + adapter; `apps/api` não importa `@prisma/client` nem
//     `@prisma/adapter-pg`);
//   - provider singleton no container Nest — nenhum outro ponto do backend
//     cria pool/cliente (o cliente interno é privado e não é exposto);
//   - conexão EAGER e fail-fast em `onModuleInit`; encerramento limpo em
//     `onModuleDestroy` (enableShutdownHooks do bootstrap dispara ambos);
//   - antes de servir qualquer operação, o bootstrap PROVA a postura de
//     privilégios exigida do runtime (capability-based, sem hardcode do nome
//     da role): em `evento_auditoria`, SELECT e INSERT permitidos e UPDATE,
//     DELETE e TRUNCATE proibidos — a postura append-only de E-11. Uma role
//     privilegiada (migrator/superuser) falha aqui e ABORTA o bootstrap.
//
// Segurança de log (TLF-BASE-V1 §10): nenhuma mensagem de erro deste arquivo
// ecoa a connection string, credencial ou valor de variável de ambiente.

import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { criarClientePersistencia } from "@techlab-fisio/database";
import type {
  ClientePersistencia,
  TransacaoPersistencia,
} from "@techlab-fisio/database";

/** Motivos de falha do bootstrap de persistência — estáveis para teste/log. */
export type MotivoFalhaPersistencia =
  | "CONFIGURACAO_AUSENTE"
  | "CONFIGURACAO_INVALIDA"
  | "CONEXAO_FALHOU"
  | "POSTURA_DE_PRIVILEGIOS_INVALIDA"
  | "CLIENTE_NAO_INICIADO"
  | "CICLO_DE_VIDA_INVALIDO";

export class ErroPersistencia extends Error {
  override readonly name = "ErroPersistencia";

  constructor(
    readonly motivo: MotivoFalhaPersistencia,
    mensagem: string,
    opcoes?: { cause?: unknown },
  ) {
    super(mensagem, opcoes);
  }
}

/** Linha devolvida pela consulta de postura (has_table_privilege). */
interface PosturaEventoAuditoria {
  pode_select: boolean;
  pode_insert: boolean;
  pode_update: boolean;
  pode_delete: boolean;
  pode_truncate: boolean;
}

/**
 * Postura EXIGIDA da role de runtime sobre `evento_auditoria` (E-11,
 * docs/07 §22.2): append-only — leitura e escrita de novos eventos, nunca
 * reescrita ou apagamento.
 */
const POSTURA_EXIGIDA: PosturaEventoAuditoria = {
  pode_select: true,
  pode_insert: true,
  pode_update: false,
  pode_delete: false,
  pode_truncate: false,
};

function urlDeRuntimeValidada(): string {
  const bruto = process.env["DATABASE_URL"];
  if (bruto === undefined || bruto === "") {
    throw new ErroPersistencia(
      "CONFIGURACAO_AUSENTE",
      "DATABASE_URL ausente: o runtime exige a URL de conexão da role de aplicação.",
    );
  }
  let analisada: URL;
  try {
    analisada = new URL(bruto);
  } catch {
    // O valor NUNCA é ecoado — pode conter credencial.
    throw new ErroPersistencia(
      "CONFIGURACAO_INVALIDA",
      "DATABASE_URL inválida: o valor não é uma URL analisável.",
    );
  }
  if (analisada.protocol !== "postgresql:" && analisada.protocol !== "postgres:") {
    throw new ErroPersistencia(
      "CONFIGURACAO_INVALIDA",
      "DATABASE_URL inválida: o esquema deve ser postgresql:// (ou postgres://).",
    );
  }
  return bruto;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /** Cliente/pool único do processo. Privado por desenho: consumidores só
   * alcançam o banco por `transacao()` — não existe caminho público para
   * operar fora de uma fronteira transacional explícita. */
  #cliente: ClientePersistencia | null = null;

  async onModuleInit(): Promise<void> {
    if (this.#cliente !== null) {
      // Prevenção de pool duplicado acidental (re-init do mesmo provider).
      throw new ErroPersistencia(
        "CICLO_DE_VIDA_INVALIDO",
        "DatabaseService já iniciado: um segundo onModuleInit criaria um pool duplicado.",
      );
    }

    const url = urlDeRuntimeValidada();
    const cliente = criarClientePersistencia({ url });

    let postura: PosturaEventoAuditoria;
    try {
      await cliente.$connect();
      // Sonda EAGER real: a consulta abaixo força uma conexão física e, no
      // mesmo passo, mede a postura de privilégios da role corrente.
      const linhas = await cliente.$queryRaw<PosturaEventoAuditoria[]>`
        SELECT
          has_table_privilege(current_user, 'public.evento_auditoria', 'SELECT')   AS pode_select,
          has_table_privilege(current_user, 'public.evento_auditoria', 'INSERT')   AS pode_insert,
          has_table_privilege(current_user, 'public.evento_auditoria', 'UPDATE')   AS pode_update,
          has_table_privilege(current_user, 'public.evento_auditoria', 'DELETE')   AS pode_delete,
          has_table_privilege(current_user, 'public.evento_auditoria', 'TRUNCATE') AS pode_truncate
      `;
      const linha = linhas[0];
      if (linha === undefined) {
        throw new Error("consulta de postura não retornou linha alguma");
      }
      postura = linha;
    } catch (causa) {
      await desconectarSilencioso(cliente);
      throw new ErroPersistencia(
        "CONEXAO_FALHOU",
        "Falha ao conectar/sondar o banco de dados no bootstrap (a URL de conexão não é registrada).",
        { cause: causa },
      );
    }

    const divergencias = (
      Object.keys(POSTURA_EXIGIDA) as Array<keyof PosturaEventoAuditoria>
    ).filter((capacidade) => postura[capacidade] !== POSTURA_EXIGIDA[capacidade]);

    if (divergencias.length > 0) {
      await desconectarSilencioso(cliente);
      const detalhe = divergencias
        .map(
          (capacidade) =>
            `${capacidade}=${String(postura[capacidade])} (esperado ${String(POSTURA_EXIGIDA[capacidade])})`,
        )
        .join(", ");
      throw new ErroPersistencia(
        "POSTURA_DE_PRIVILEGIOS_INVALIDA",
        "Postura de privilégios incompatível com o runtime em evento_auditoria: " +
          `${detalhe}. O bootstrap foi abortado — a API não sobe com role privilegiada ` +
          "nem com role sem os privilégios mínimos.",
      );
    }

    this.#cliente = cliente;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.#cliente !== null) {
      const cliente = this.#cliente;
      this.#cliente = null;
      await cliente.$disconnect();
    }
  }

  /**
   * FRONTEIRA TRANSACIONAL da aplicação: executa `corpo` dentro de UMA única
   * transação interativa. O cliente transacional é passado EXPLICITAMENTE ao
   * callback — mutação de negócio e evento de auditoria obrigatório devem
   * acontecer sobre o MESMO `tx`. Qualquer exceção no corpo faz ROLLBACK
   * integral.
   */
  async transacao<T>(
    corpo: (tx: TransacaoPersistencia) => Promise<T>,
  ): Promise<T> {
    if (this.#cliente === null) {
      throw new ErroPersistencia(
        "CLIENTE_NAO_INICIADO",
        "DatabaseService ainda não iniciado: transação indisponível antes do onModuleInit.",
      );
    }
    return this.#cliente.$transaction(async (tx) => corpo(tx));
  }
}

async function desconectarSilencioso(cliente: ClientePersistencia): Promise<void> {
  try {
    await cliente.$disconnect();
  } catch {
    // O erro original do bootstrap é o que importa; falha de desconexão em
    // caminho de erro não deve mascará-lo.
  }
}
