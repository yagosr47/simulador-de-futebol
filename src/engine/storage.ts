import { GameState } from '../types/game';

const STORAGE_KEY = 'gestor_fc_pro_save_v1';

export function saveGameState(state: GameState): boolean {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.error('Falha ao salvar progresso automaticamente:', err);
    return false;
  }
}

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== 1 || !parsed.userClubId || !parsed.clubs || !parsed.players) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('Save corrompido ou ilegível, iniciando novo estado:', err);
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportSaveJson(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

export function parseImportedSaveJson(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== 1 || !parsed.clubs || !parsed.players || !parsed.userClubId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
