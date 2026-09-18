// TechLab Fisio — módulo da agenda (M5, fatia AGD-A; `docs/15` D-AGD-01).
//
// Este é o CONSUMIDOR que faltava aos dois verificadores já entregues por
// CFG-002 e PRO-003: `VerificadorHorarioFuncionamento` e
// `VerificadorDisponibilidadeProfissional` viviam em `src/agenda/` desde
// `docs/14` §5 e `docs/16` §4.4, testados e sem registro em módulo algum
// porque a agenda não existia. Eles passam a ser providers deste módulo — as
// regras NÃO foram reimplementadas nem duplicadas.
//
// IMPORTS:
//   AuthzModule ... @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para
//                   agendamento.criado / remarcado / cancelado.
//
// `ProtecaoCsrfGuard` é provida no injetor do módulo do controller, como nos
// demais módulos com mutação.
//
// O QUE ESTE MÓDULO NÃO CONTÉM, e nenhuma linha dele prepara: criação ou remoção
// de bloqueio (AGD-C), modalidade `PACOTE` e
// `reserva_sessao` (AGD-D), início e conclusão de atendimento (AGD-E),
// recorrência, notificações, lista de espera, agendamento público e sugestão
// automática de horários (`D-AGD-17`, TLF-BASE §13).

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AgendaOpcoesController } from "./agenda-opcoes.controller.js";
import { AgendaOpcoesService } from "./agenda-opcoes.service.js";
import { EscopoAgendaService } from "./agenda.escopo.js";
import { AgendamentosController } from "./agendamentos.controller.js";
import { AgendamentosService } from "./agendamentos.service.js";
import { VerificadorDisponibilidadeProfissional } from "./verificador-disponibilidade-profissional.js";
import { VerificadorHorarioFuncionamento } from "./verificador-horario-funcionamento.js";

@Module({
  imports: [DatabaseModule, AuthzModule, AuditModule],
  controllers: [AgendamentosController, AgendaOpcoesController],
  providers: [
    ProtecaoCsrfGuard,
    EscopoAgendaService,
    VerificadorHorarioFuncionamento,
    VerificadorDisponibilidadeProfissional,
    AgendamentosService,
    AgendaOpcoesService,
  ],
  exports: [AgendamentosService, AgendaOpcoesService],
})
export class AgendaModule {}
