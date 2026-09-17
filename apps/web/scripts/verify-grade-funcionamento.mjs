// TechLab Fisio — Verificações da lógica pura da tela de horário de funcionamento
// (CFG-002; `docs/14` D-CFG-13, D-CFG-18, D-CFG-58, D-CFG-59, D-CFG-66).
//
// Importa diretamente `lib/grade-funcionamento.ts` (type stripping do Node 24),
// sem reimplementação local, para validar o código enviado ao navegador.

import {
  DIAS_EXIBICAO,
  gradeParaRascunho,
  mesmoConteudo,
  rascunhoParaCorpo,
  rascunhoValido,
  rascunhoVazio,
  validarDia,
} from "../lib/grade-funcionamento.ts";

const ROTULO = "[grade-funcionamento]";
const falhas = [];
let total = 0;
function conferir(descricao, condicao, detalhe = "") {
  total += 1;
  if (condicao) {
    console.log(`${ROTULO} OK   — ${descricao}`);
  } else {
    console.error(`${ROTULO} FALHA — ${descricao}${detalhe ? ` (${detalhe})` : ""}`);
    falhas.push(descricao);
  }
}

let n = 0;
const j = (horaInicio, horaFim) => ({ chave: `t${++n}`, horaInicio, horaFim });
const semErros = (janelas) => {
  const e = validarDia(janelas);
  return e.dia === null && Object.keys(e.porJanela).length === 0;
};

// Grade (CH-G-*)
conferir("CH-G-01 aceita 08:00–18:00", semErros([j("08:00", "18:00")]));
conferir("CH-G-04 aceita 08:00–12:00 + 14:00–18:00", semErros([j("14:00", "18:00"), j("08:00", "12:00")]));
conferir("CH-G-03 dia sem janela é válido (fechado)", semErros([]));
conferir("CH-G-05 rejeita sobreposição 08:00–12:00 + 11:00–14:00", !semErros([j("08:00", "12:00"), j("11:00", "14:00")]));
conferir("CH-G-06 rejeita adjacência 08:00–12:00 + 12:00–18:00", !semErros([j("08:00", "12:00"), j("12:00", "18:00")]));
conferir("CH-G-07 rejeita 08:00–08:00", !semErros([j("08:00", "08:00")]));
conferir("CH-G-08 rejeita 18:00–08:00 (meia-noite)", !semErros([j("18:00", "08:00")]));
conferir("D-CFG-59 aceita 00:00–23:59", semErros([j("00:00", "23:59")]));
conferir("CH-G-09 rejeita 24:00", !semErros([j("08:00", "24:00")]));
conferir("CH-G-09 rejeita segundos", !semErros([j("08:00:00", "12:00")]));
conferir("CH-G-09 rejeita hora sem zero à esquerda", !semErros([j("8:00", "12:00")]));
conferir("rejeita janela incompleta", !semErros([j("", "12:00")]));
conferir(
  "CH-G-10 rejeita 5 janelas no dia",
  validarDia([j("06:00", "07:00"), j("08:00", "09:00"), j("10:00", "11:00"), j("12:00", "13:00"), j("14:00", "15:00")]).dia !== null,
);
conferir("aceita 4 janelas no dia", semErros([j("06:00", "07:00"), j("08:00", "09:00"), j("10:00", "11:00"), j("12:00", "13:00")]));

const adj = [j("08:00", "12:00"), j("12:00", "18:00")];
const msgAdj = validarDia(adj).porJanela[adj[1].chave] ?? "";
conferir("mensagem de adjacência sugere janela única", msgAdj.includes("08:00–18:00"), msgAdj);

// Conversões
const grade = {
  janelas: [
    { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
    { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
    { diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" },
  ],
};
const rascunho = gradeParaRascunho(grade);
conferir("rascunho tem 7 dias indexados por diaSemana", rascunho.length === 7 && rascunho[0].length === 0 && rascunho[1].length === 2);
const corpo = rascunhoParaCorpo(rascunho);
conferir(
  "corpo do PUT é a grade inteira em ordem canônica (dia, início) e só com as chaves do contrato",
  JSON.stringify(corpo) ===
    JSON.stringify({
      janelas: [
        { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
        { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
        { diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" },
      ],
    }),
  JSON.stringify(corpo),
);
conferir("grade vazia gera { janelas: [] }", JSON.stringify(rascunhoParaCorpo(rascunhoVazio())) === '{"janelas":[]}');
conferir("mesmoConteudo ignora chaves e ordem", mesmoConteudo(rascunho, gradeParaRascunho({ janelas: [...grade.janelas].reverse() })));
conferir("rascunhoValido detecta erro em qualquer dia", !rascunhoValido([[], [], [], [], [], [], [j("10:00", "09:00")]]));
conferir(
  "exibição cobre os 7 dias, segunda primeiro e domingo = 0",
  DIAS_EXIBICAO.length === 7 &&
    new Set(DIAS_EXIBICAO.map((d) => d.diaSemana)).size === 7 &&
    DIAS_EXIBICAO[0].diaSemana === 1 &&
    DIAS_EXIBICAO[6].diaSemana === 0,
);

console.log(`${ROTULO} ${total - falhas.length}/${total} verificações OK`);
if (falhas.length > 0) process.exit(1);
