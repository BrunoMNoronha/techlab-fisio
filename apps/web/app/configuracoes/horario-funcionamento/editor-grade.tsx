"use client";

// TechLab Fisio — Editor da grade semanal (Client Component).
//
// D-CFG-66: aberto/fechado derivado das janelas; até 4 janelas por dia; salvar
// envia a grade inteira num único PUT e adota a resposta como estado vigente.
// A validação local é só ajuda: o `400 REQUISICAO_INVALIDA` do servidor não
// detalha o campo, por isso a mensagem de rejeição é genérica.

import { useEffect, useState } from "react";
import { clienteHttp } from "../../../lib/api-cliente";
import {
  DIAS_EXIBICAO,
  JANELAS_POR_DIA,
  gradeParaRascunho,
  mesmoConteudo,
  novaChave,
  rascunhoParaCorpo,
  rascunhoValido,
  rascunhoVazio,
  validarDia,
  type GradeApi,
  type JanelaRascunho,
  type Rascunho,
} from "../../../lib/grade-funcionamento";

type Carga =
  | { readonly estado: "carregando" }
  | { readonly estado: "pronto" }
  | { readonly estado: "bloqueado"; readonly mensagem: string; readonly login: boolean };

type Aviso = { readonly tipo: "sucesso" | "erro"; readonly texto: string } | null;

function mensagemBloqueio(status: number, erro: string): { mensagem: string; login: boolean } {
  if (status === 401) return { mensagem: "Sua sessão não é válida. Entre novamente para continuar.", login: true };
  if (status === 403) {
    return { mensagem: "Você não tem permissão para configurar a clínica.", login: false };
  }
  if (status === 404 && erro === "CLINICA_NAO_CONFIGURADA") {
    return { mensagem: "A clínica ainda não foi provisionada. Procure o responsável técnico.", login: false };
  }
  return { mensagem: "Não foi possível carregar o horário de funcionamento. Tente novamente.", login: false };
}

const classeCampo =
  "mt-1 block w-full rounded-md border bg-surface px-3 py-2 text-surface-foreground shadow-xs disabled:opacity-50 sm:text-sm";
const classeBotaoSecundario =
  "inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function EditorGrade() {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [vigente, setVigente] = useState<Rascunho>(rascunhoVazio);
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio);
  const [salvando, setSalvando] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    let ativo = true;
    void clienteHttp.get<GradeApi>("/api/horario-funcionamento").then((r) => {
      if (!ativo) return;
      if (!r.sucesso) {
        setCarga({ estado: "bloqueado", ...mensagemBloqueio(r.status, r.erro) });
        return;
      }
      const grade = gradeParaRascunho(r.dados);
      setVigente(grade);
      setRascunho(grade);
      setCarga({ estado: "pronto" });
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (carga.estado === "carregando") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando horário de funcionamento...
      </p>
    );
  }

  if (carga.estado === "bloqueado") {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <p>{carga.mensagem}</p>
        {carga.login && (
          <a href="/login" className="mt-2 inline-block font-medium underline">
            Ir para o login
          </a>
        )}
      </div>
    );
  }

  const alterado = !mesmoConteudo(rascunho, vigente);
  const valido = rascunhoValido(rascunho);

  function alterarDia(diaSemana: number, janelas: readonly JanelaRascunho[]) {
    setAviso(null);
    setRascunho((atual) => atual.map((dia, i) => (i === diaSemana ? janelas : dia)));
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTentouSalvar(true);
    setAviso(null);
    if (!valido) {
      setAviso({ tipo: "erro", texto: "Corrija os horários indicados antes de salvar." });
      return;
    }
    setSalvando(true);
    const r = await clienteHttp.put<GradeApi>("/api/horario-funcionamento", rascunhoParaCorpo(rascunho));
    setSalvando(false);
    if (!r.sucesso) {
      if (r.status === 401 || r.status === 403) {
        setCarga({ estado: "bloqueado", ...mensagemBloqueio(r.status, r.erro) });
        return;
      }
      setAviso({
        tipo: "erro",
        texto:
          r.status === 400
            ? "O servidor recusou a grade. Revise os horários: sem sobreposição, sem janelas encostadas e no máximo 4 por dia."
            : "Não foi possível salvar. Tente novamente.",
      });
      return;
    }
    const grade = gradeParaRascunho(r.dados);
    setVigente(grade);
    setRascunho(grade);
    setTentouSalvar(false);
    setAviso({ tipo: "sucesso", texto: "Horário de funcionamento salvo." });
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-4" aria-labelledby="horario-titulo">
      {DIAS_EXIBICAO.map(({ diaSemana, nome }) => (
        <CartaoDia
          key={diaSemana}
          nome={nome}
          janelas={rascunho[diaSemana] ?? []}
          mostrarErros={tentouSalvar}
          desabilitado={salvando}
          onChange={(janelas) => alterarDia(diaSemana, janelas)}
        />
      ))}

      <div aria-live="polite">
        {aviso && (
          <p
            role={aviso.tipo === "erro" ? "alert" : "status"}
            className={
              aviso.tipo === "erro"
                ? "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                : "rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
            }
          >
            {aviso.texto}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={classeBotaoSecundario}
          disabled={!alterado || salvando}
          onClick={() => {
            setRascunho(vigente);
            setTentouSalvar(false);
            setAviso(null);
          }}
        >
          Descartar alterações
        </button>
        <button
          type="submit"
          disabled={!alterado || salvando}
          aria-busy={salvando}
          className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar horário"}
        </button>
      </div>
    </form>
  );
}

interface PropsCartaoDia {
  readonly nome: string;
  readonly janelas: readonly JanelaRascunho[];
  readonly mostrarErros: boolean;
  readonly desabilitado: boolean;
  readonly onChange: (janelas: readonly JanelaRascunho[]) => void;
}

function CartaoDia({ nome, janelas, mostrarErros, desabilitado, onChange }: PropsCartaoDia) {
  const aberto = janelas.length > 0;
  const erros = validarDia(janelas);
  const idBase = nome.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase();

  function atualizar(chave: string, campo: "horaInicio" | "horaFim", valor: string) {
    onChange(janelas.map((j) => (j.chave === chave ? { ...j, [campo]: valor } : j)));
  }

  function adicionar() {
    onChange([...janelas, { chave: novaChave(), horaInicio: "", horaFim: "" }]);
  }

  return (
    <fieldset className="rounded-md border border-border bg-surface p-4 text-surface-foreground sm:p-5">
      <legend className="sr-only">{nome}</legend>
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden="true" className="text-base font-medium">
          {nome}
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aberto}
            disabled={desabilitado}
            onChange={(e) => (e.target.checked ? adicionar() : onChange([]))}
            className="h-4 w-4 accent-primary"
          />
          <span>{aberto ? "Aberto" : "Fechado"}</span>
          <span className="sr-only">— {nome}</span>
        </label>
      </div>

      {aberto && (
        <ol className="mt-4 space-y-3">
          {janelas.map((j, i) => {
            const erro = mostrarErros ? erros.porJanela[j.chave] : undefined;
            const idErro = `${idBase}-${j.chave}-erro`;
            const rotulo = `janela ${i + 1} de ${nome.toLowerCase()}`;
            return (
              <li key={j.chave} className="rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="block text-sm">
                    <span className="font-medium">Início</span>
                    <span className="sr-only"> da {rotulo}</span>
                    <input
                      type="time"
                      step={60}
                      required
                      value={j.horaInicio}
                      disabled={desabilitado}
                      aria-invalid={erro ? true : undefined}
                      aria-describedby={erro ? idErro : undefined}
                      onChange={(e) => atualizar(j.chave, "horaInicio", e.target.value)}
                      className={`${classeCampo} ${erro ? "border-destructive" : "border-border"}`}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Fim</span>
                    <span className="sr-only"> da {rotulo}</span>
                    <input
                      type="time"
                      step={60}
                      required
                      value={j.horaFim}
                      disabled={desabilitado}
                      aria-invalid={erro ? true : undefined}
                      aria-describedby={erro ? idErro : undefined}
                      onChange={(e) => atualizar(j.chave, "horaFim", e.target.value)}
                      className={`${classeCampo} ${erro ? "border-destructive" : "border-border"}`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={desabilitado}
                    onClick={() => onChange(janelas.filter((x) => x.chave !== j.chave))}
                    className={`${classeBotaoSecundario} col-span-2 sm:col-span-1`}
                  >
                    Remover<span className="sr-only"> {rotulo}</span>
                  </button>
                </div>
                {erro && (
                  <p id={idErro} className="mt-2 text-sm text-destructive">
                    {erro}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {aberto && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={desabilitado || janelas.length >= JANELAS_POR_DIA}
            onClick={adicionar}
            className={classeBotaoSecundario}
          >
            Adicionar janela<span className="sr-only"> em {nome.toLowerCase()}</span>
          </button>
          {janelas.length >= JANELAS_POR_DIA && (
            <span className="text-xs text-muted-foreground">Limite de {JANELAS_POR_DIA} janelas por dia.</span>
          )}
          {erros.dia && <span className="text-sm text-destructive">{erros.dia}</span>}
        </div>
      )}
    </fieldset>
  );
}
