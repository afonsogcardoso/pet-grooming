/**
 * Remove acentos de uma string para facilitar pesquisas
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Compara duas strings ignorando acentos e case
 */
export function matchesSearchQuery(text: string, query: string): boolean {
  return removeAccents(text.toLowerCase()).includes(removeAccents(query.toLowerCase()));
}
