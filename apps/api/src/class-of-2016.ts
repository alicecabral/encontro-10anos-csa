import { readFile } from 'node:fs/promises';

export type ClassOf2016RosterEntry = {
  name: string;
  classroom: string;
  nameTokens: string[];
};

function normalizeName(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('pt-BR')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

export function parseClassOf2016Roster(contents: string): ClassOf2016RosterEntry[] {
  const entries = contents
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const [name, classroom] = line.split(';');
      const trimmedName = name?.trim();
      const trimmedClassroom = classroom?.trim();
      const nameTokens = trimmedName ? normalizeName(trimmedName) : [];

      if (!trimmedName || !trimmedClassroom || nameTokens.length === 0) {
        throw new Error(`Registro inválido no CSV da turma de 2016, linha ${index + 1}.`);
      }

      return { name: trimmedName, classroom: trimmedClassroom, nameTokens };
    });

  if (entries.length === 0) {
    throw new Error('O CSV da turma de 2016 não contém participantes.');
  }

  return entries;
}

export async function loadClassOf2016Roster() {
  const rosterUrl = new URL('../assets/terceiro_ano_2016.csv', import.meta.url);
  const contents = await readFile(rosterUrl, 'utf8');
  return parseClassOf2016Roster(contents);
}

function findClassForNameParts(parts: string[], roster: ClassOf2016RosterEntry[]) {
  const requestedTokens = parts.flatMap(normalizeName);
  if (requestedTokens.length === 0) return null;

  const match = roster.find((entry) =>
    requestedTokens.every((token) => entry.nameTokens.includes(token)),
  );
  return match?.classroom ?? null;
}

export function findClassForParticipant(
  firstName: string,
  lastName: string,
  roster: ClassOf2016RosterEntry[],
) {
  return findClassForNameParts([firstName, lastName], roster);
}

export function findClassForStoredName(name: string, roster: ClassOf2016RosterEntry[]) {
  return findClassForNameParts([name], roster);
}
