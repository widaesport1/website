import type { APIRoute } from 'astro';

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

const teamSections = [
  {
    id: 'organization',
    label: 'Organization',
    title: 'Organization all-time stats',
    description: 'All-time stats across the WIDA organization.',
  },
  {
    id: 'wida',
    label: 'Wida',
    title: 'Wida all-time stats',
    description: 'All-time player and goalkeeper stats for Wida.',
  },
  {
    id: 'wigor',
    label: 'Wigor',
    title: 'Wigor all-time stats',
    description: 'All-time player and goalkeeper stats for Wigor.',
  },
  {
    id: 'wibe',
    label: 'Wibe',
    title: 'Wibe all-time stats',
    description: 'All-time player and goalkeeper stats for Wibe.',
  },
];

const parseNumber = (value: unknown) => {
  const cleanedValue = String(value ?? '')
    .replace('%', '')
    .replace(',', '.')
    .trim();

  const number = Number(cleanedValue);

  return Number.isFinite(number) ? number : 0;
};

const normalizeTeam = (value: unknown) => {
  return String(value ?? '')
    .trim()
    .toLowerCase();
};

const fetchSheetRange = async (range: string) => {
  const apiKey = import.meta.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = import.meta.env.GOOGLE_SHEET_ID;

  if (!apiKey || !sheetId) {
    throw new Error('Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEET_ID in .env');
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
  const gamesHeader = String(row[2] ?? '').trim().toLowerCase();
  const savesHeader = String(row[3] ?? '').trim().toLowerCase();

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
      player: row[1] ?? '',
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
      player: row[1] ?? '',
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
    const eclRows = await fetchSheetRange("'ECL'!A1:H40");

    const players = parsePlayerStats(eclRows);
    const goalies = parseGoalieStats(eclRows);

    const statGroups = teamSections.map((section) => {
      if (section.id === 'organization') {
        return {
          ...section,
          players: sortPlayers(players),
          goalies: sortGoalies(goalies),
        };
      }

      return {
        ...section,
        players: sortPlayers(players.filter((player) => player.team === section.id)),
        goalies: sortGoalies(goalies.filter((goalie) => goalie.team === section.id)),
      };
    });

    return new Response(
      JSON.stringify({
        statGroups,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
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