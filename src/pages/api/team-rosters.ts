import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

type RosterPlayer = {
  team: string;
  name: string;
  gamertag: string;
  number: string;
  dataName: string;
  position: 'F' | 'D' | 'GK';
};

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

const teamInfo = [
  {
    slug: 'wida',
    name: 'Wida',
  },
  {
    slug: 'wigor',
    name: 'Wigor',
  },
  {
    slug: 'wibe',
    name: 'Wibe',
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

const normalizeText = (value: unknown) => {
  return String(value ?? '')
    .trim()
    .toLowerCase();
};

const normalizeTeam = (value: unknown) => {
  return normalizeText(value);
};

const normalizePosition = (value: unknown) => {
  const position = String(value ?? '').trim().toUpperCase();

  if (position === 'F' || position === 'D' || position === 'GK') {
    return position;
  }

  return '';
};

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replaceAll('ä', 'a')
    .replaceAll('ö', 'o')
    .replaceAll('å', 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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

const isRealValue = (value: unknown) => {
  const text = String(value ?? '').trim();

  return text !== '' && text !== '?';
};

const parseRoster = (rows: string[][]): RosterPlayer[] => {
  return rows
    .slice(1)
    .map((row) => {
      const name = String(row[0] ?? '').trim();
      const gamertag = String(row[1] ?? '').trim();
      const number = String(row[2] ?? '').trim();
      const team = normalizeTeam(row[3]);
      const dataName = String(row[4] ?? '').trim();
      const position = normalizePosition(row[5]);

      return {
        team,
        name,
        gamertag,
        number,
        dataName,
        position,
      };
    })
    .filter((player) => {
      return (
        isRealValue(player.name) &&
        isRealValue(player.team) &&
        isRealValue(player.dataName) &&
        Boolean(player.position) &&
        ['wida', 'wigor', 'wibe'].includes(player.team)
      );
    }) as RosterPlayer[];
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

const createStatKey = (team: string, player: string) => {
  return `${normalizeTeam(team)}:${normalizeText(player)}`;
};

export const GET: APIRoute = async () => {
  try {
    const [rosterRows, currentSeasonRows] = await Promise.all([
      fetchSheetRange("'Pelaajalista'!A1:F100"),
      fetchSheetRange("'Aktiivinen kausi'!A1:H40"),
    ]);

    const roster = parseRoster(rosterRows);
    const playerStats = parsePlayerStats(currentSeasonRows);
    const goalieStats = parseGoalieStats(currentSeasonRows);

    const playerStatsMap = new Map(
      playerStats.map((player) => [createStatKey(player.team, player.player), player])
    );

    const goalieStatsMap = new Map(
      goalieStats.map((goalie) => [createStatKey(goalie.team, goalie.player), goalie])
    );

    const teams = teamInfo.map((team) => {
      const teamPlayers = roster
        .filter((player) => player.team === team.slug)
        .map((player) => {
          const statKey = createStatKey(player.team, player.dataName);

          const skaterStats = playerStatsMap.get(statKey);
          const goalieStats = goalieStatsMap.get(statKey);

          return {
            id: `${player.team}-${slugify(player.dataName)}`,
            team: player.team,
            name: player.name,
            gamertag: player.gamertag,
            number: player.number,
            dataName: player.dataName,
            position: player.position,
            image: '/teams/players/player-placeholder.jpg',

            stats:
              player.position === 'GK'
                ? {
                    games: goalieStats?.games ?? 0,
                    saves: goalieStats?.saves ?? 0,
                    pm: goalieStats?.pm ?? 0,
                    ly: goalieStats?.ly ?? 0,
                    savePercentage: goalieStats?.savePercentage ?? 0,
                    gaa: goalieStats?.gaa ?? 0,
                  }
                : {
                    games: skaterStats?.games ?? 0,
                    goals: skaterStats?.goals ?? 0,
                    assists: skaterStats?.assists ?? 0,
                    points: skaterStats?.points ?? 0,
                  },
          };
        });

      return {
        ...team,
        forwards: teamPlayers.filter((player) => player.position === 'F'),
        defensemen: teamPlayers.filter((player) => player.position === 'D'),
        goalkeepers: teamPlayers.filter((player) => player.position === 'GK'),
      };
    });

    return new Response(
      JSON.stringify({
        teams,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while loading team rosters';

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