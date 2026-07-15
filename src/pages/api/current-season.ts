import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

type CurrentSeasonPlayerStat = {
  team: string;
  player: string;
  games: number;
  goals: number;
  assists: number;
  points: number;
};

type CurrentSeasonGoalieStat = {
  team: string;
  player: string;
  games: number;
  saves: number;
  pm: number;
  ly: number;
  savePercentage: number;
  gaa: number;
};

const parseNumber = (value: unknown) => {
  const cleanedValue = String(value ?? '')
    .replace('%', '')
    .replace(',', '.')
    .replace('#DIV/0!', '')
    .trim();

  const number = Number(cleanedValue);

  return Number.isFinite(number) ? number : 0;
};

const normalizeText = (value: unknown) => {
  return String(value ?? '')
    .trim()
    .toLowerCase();
};

const normalizeTeam = (value: unknown) => {
  return normalizeText(value);
};

const fetchSheetRange = async (range: string) => {
  const apiKey =
    env.GOOGLE_SHEETS_API_KEY ?? import.meta.env.GOOGLE_SHEETS_API_KEY;

  const sheetId =
    env.GOOGLE_SHEET_ID ?? import.meta.env.GOOGLE_SHEET_ID;

  if (!apiKey || !sheetId) {
    throw new Error('Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEET_ID');
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  );

  url.searchParams.set('key', apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Google Sheets request failed: ${errorText}`);
  }

  const data = await response.json();

  return data.values ?? [];
};

const isGoalieHeaderRow = (row: string[]) => {
  const gamesHeader = normalizeText(row[2]);
  const savesHeader = normalizeText(row[3]);

  return gamesHeader === 'ottelut' && savesHeader === 'saves';
};

const hasPlayerName = (row: string[]) => {
  return Boolean(String(row[1] ?? '').trim());
};

const parsePlayerStats = (rows: string[][]): CurrentSeasonPlayerStat[] => {
  const goalieHeaderIndex = rows.findIndex(isGoalieHeaderRow);
  const playerRows =
    goalieHeaderIndex >= 0 ? rows.slice(1, goalieHeaderIndex) : rows.slice(1, 25);

  return playerRows
    .filter((row) => row[0] && hasPlayerName(row))
    .map((row) => ({
      team: normalizeTeam(row[0]),
      player: String(row[1] ?? '').trim(),
      games: parseNumber(row[2]),
      goals: parseNumber(row[3]),
      assists: parseNumber(row[4]),
      points: parseNumber(row[5]),
    }));
};

const parseGoalieStats = (rows: string[][]): CurrentSeasonGoalieStat[] => {
  const goalieHeaderIndex = rows.findIndex(isGoalieHeaderRow);

  if (goalieHeaderIndex < 0) {
    return [];
  }

  return rows
    .slice(goalieHeaderIndex + 1)
    .filter((row) => row[0] && hasPlayerName(row))
    .map((row) => ({
      team: normalizeTeam(row[0]),
      player: String(row[1] ?? '').trim(),
      games: parseNumber(row[2]),
      saves: parseNumber(row[3]),
      pm: parseNumber(row[4]),
      ly: parseNumber(row[5]),
      savePercentage: parseNumber(row[6]),
      gaa: parseNumber(row[7]),
    }));
};

export const GET: APIRoute = async () => {
  try {
    const rows = await fetchSheetRange("'Aktiivinen kausi'!A1:H40");

    const players = parsePlayerStats(rows);
    const goalies = parseGoalieStats(rows);

    return new Response(
      JSON.stringify({
        players,
        goalies,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error while loading current season stats';

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};