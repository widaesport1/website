import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

type PlayerStat = {
  team: string;
  player: string;
  games: number;
  goals: number;
  assists: number;
  points: number;
};

type GoalieStat = {
  team: string;
  player: string;
  games: number;
  saves: number;
  pm: number;
  ly: number;
  savePercentage: number;
  gaa: number;
};

const statSources = [
  {
    id: 'ecl',
    label: 'ECL',
    title: 'ECL all-time stats',
    description: 'Overall ECL player and goalkeeper stats, including previous teams.',
    range: "'ECL'!A1:H40",
  },
  {
    id: 'organization',
    label: 'Organization',
    title: 'Organization all-time stats',
    description: 'All-time player and goalkeeper stats inside the WIDA organization.',
    range: "'Pisteet organisaatio Alltime'!A1:H40",
  },
];

const parseNumber = (value: unknown) => {
  const cleanedValue = String(value ?? '')
    .replace('%', '')
    .replace(',', '.')
    .replace('#DIV/0!', '')
    .trim();

  const number = Number(cleanedValue);

  return Number.isFinite(number) ? number : 0;
};

const normalizeTeam = (value: unknown) => {
  return String(value ?? '').trim();
};

const normalizeText = (value: unknown) => {
  return String(value ?? '').trim().toLowerCase();
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

const parsePlayerStats = (rows: string[][]): PlayerStat[] => {
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

const parseGoalieStats = (rows: string[][]): GoalieStat[] => {
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

const sortPlayers = (players: PlayerStat[]) => {
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goals !== a.goals) return b.goals - a.goals;

    return b.games - a.games;
  });
};

const sortGoalies = (goalies: GoalieStat[]) => {
  return [...goalies].sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    if (b.saves !== a.saves) return b.saves - a.saves;

    return b.savePercentage - a.savePercentage;
  });
};

export const GET: APIRoute = async () => {
  try {
    const sheetResults = await Promise.all(
      statSources.map(async (source) => {
        const rows = await fetchSheetRange(source.range);

        return {
          ...source,
          players: sortPlayers(parsePlayerStats(rows)),
          goalies: sortGoalies(parseGoalieStats(rows)),
        };
      })
    );

    const statGroups = sheetResults.map((source) => ({
      id: source.id,
      label: source.label,
      title: source.title,
      description: source.description,
      players: source.players,
      goalies: source.goalies,
    }));

    return new Response(
      JSON.stringify({
        statGroups,
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
      error instanceof Error ? error.message : 'Unknown error while loading stats';

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