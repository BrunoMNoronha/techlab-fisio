// TechLab Fisio — módulo do SEED RBAC (Etapa 2.3D-B / F5 — fatia corretiva).
//
// CONTEXTO MÍNIMO, e a razão é operacional, não estética: o seed do catálogo
// não tem nada a ver com credenciais. Antes desta rodada, seed e bootstrap
// compartilhavam um módulo que provia `CredencialService`; com isso o comando
// `seed` carregava o addon nativo do Argon2 e ficava indisponível em qualquer
// máquina onde esse addon não carregue — situação REAL e medida no host
// Windows deste projeto (Application Control bloqueia o `.node` não assinado).
//
// Agora `seed` depende exclusivamente de `DatabaseModule`. Some-se a isso o
// fato de o CLI importar o módulo do bootstrap de forma DINÂMICA, e o comando
// `seed` passa a funcionar mesmo com o runtime Argon2 indisponível — o que é
// provado por teste, não prometido.
//
// ESTE MÓDULO NÃO É IMPORTADO PELO `AppModule`: subir a API não semeia nada.

import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { SeedRbacService } from "./seed-rbac.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [SeedRbacService],
  exports: [SeedRbacService],
})
export class SeedModule {}
