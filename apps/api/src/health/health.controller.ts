// TechLab Fisio — health check mínimo de infraestrutura (Etapa 2.3A, Bloco D).
//
// O contrato é deliberadamente o MENOR payload capaz de provar que o NestJS
// subiu e responde HTTP. Nenhuma versão interna, segredo, connection string,
// dado de banco ou stack trace (TLF-BASE-V1 §10). Observabilidade completa é
// escopo futuro.

import { Controller, Get } from "@nestjs/common";

export interface RespostaHealth {
  status: "ok";
}

@Controller("health")
export class HealthController {
  @Get()
  verificar(): RespostaHealth {
    return { status: "ok" };
  }
}
