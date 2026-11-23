export function chaveCategoriaFinanceira(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
