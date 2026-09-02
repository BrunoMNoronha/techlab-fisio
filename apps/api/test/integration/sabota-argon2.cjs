// TechLab Fisio — sabotador determinístico do addon nativo do Argon2
// (Etapa 2.3D-B / F5 — fatia corretiva). ARTEFATO DE TESTE.
//
// Reproduz, de forma controlada e portátil, a condição REAL medida no host
// Windows deste projeto: uma política de Application Control impede o
// carregamento do `.node` não assinado do `argon2`, e qualquer tentativa
// falha com `ERR_DLOPEN_FAILED`.
//
// É carregado por `--require` no processo FILHO do CLI, e intercepta apenas
// o `dlopen` do argon2 — nenhum outro addon nativo é afetado. Serve para
// provar, sem depender da política da máquina, que o comando `seed` NÃO toca
// o Argon2 (e que `bootstrap-admin` toca — o controle positivo).

const dlopenOriginal = process.dlopen.bind(process);

process.dlopen = function dlopenSabotado(modulo, arquivo, sinalizadores) {
  if (String(arquivo).includes("argon2")) {
    const erro = new Error(
      "An Application Control policy has blocked this file. (simulado por sabota-argon2.cjs)",
    );
    erro.code = "ERR_DLOPEN_FAILED";
    throw erro;
  }
  return dlopenOriginal(modulo, arquivo, sinalizadores);
};
