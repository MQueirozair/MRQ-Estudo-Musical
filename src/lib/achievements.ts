/** Motor de conquistas — deriva o estado a partir dos eventos de uso */
import type { AchievementState } from '../pages/ConquistasPage';

export function emptyAchievements(): AchievementState {
  return { acertos: 0, explorados: [], escalas: [], progressoes: [], composicoes: 0, composicoesLista: [], dias: [] };
}

export function addUnique(list: string[] | undefined, value: string): string[] {
  const arr = list ?? [];
  if (arr.includes(value)) return arr;
  return [...arr, value].slice(-400);
}

export function addDay(list: string[] | undefined, day: string): string[] {
  const arr = list ?? [];
  if (arr.includes(day)) return arr;
  return [...arr, day].slice(-400);
}
