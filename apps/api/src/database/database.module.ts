// TechLab Fisio — módulo de persistência do backend (Etapa 2.3B).
//
// Registra o DatabaseService como provider SINGLETON (escopo padrão do Nest):
// um único cliente/pool por processo, com ciclo de vida amarrado ao ciclo do
// módulo (conexão eager no init; encerramento limpo no destroy — acionado
// pelo enableShutdownHooks do bootstrap).

import { Module } from "@nestjs/common";

import { DatabaseService } from "./database.service.js";

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
