export type PlayerStat = {
  rank: number;
  player: string;
  gamertag: string;
  seasons: number;
  games: number;
  goals: number;
  assists: number;
  points: number;
};

export type GoalieStat = {
  rank: number;
  player: string;
  gamertag: string;
  seasons: number;
  games: number;
  wins: number;
  losses: number;
  saves: number;
  savePercentage: number;
  shutouts: number;
};

export type StatGroup = {
  id: string;
  label: string;
  title: string;
  description: string;
  players: PlayerStat[];
  goalies: GoalieStat[];
};

export const statsHeroCards = [
  {
    label: 'Stat type',
    value: 'All-time',
  },
  {
    label: 'Teams',
    value: 'Wida / Wigor / Wibe',
  },
  {
    label: 'Categories',
    value: 'Players & goalies',
  },
];

const widaPlayers: PlayerStat[] = [
  {
    rank: 1,
    player: 'Niklas Laine',
    gamertag: 'nikitikitin',
    seasons: 6,
    games: 217,
    goals: 285,
    assists: 294,
    points: 579,
  },
  {
    rank: 2,
    player: 'Severi Pasma',
    gamertag: 'seosteve',
    seasons: 0,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
  },
  {
    rank: 3,
    player: 'Darcy Tucker',
    gamertag: 'Hattor111',
    seasons: 0,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
  },
  {
    rank: 4,
    player: 'Joonas Harju',
    gamertag: 'herrquu',
    seasons: 0,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
  },
];

const widaGoalies: GoalieStat[] = [
  {
    rank: 1,
    player: 'Goalkeeper One',
    gamertag: 'GoalieGT1',
    seasons: 0,
    games: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    savePercentage: 0,
    shutouts: 0,
  },
];

const wigorPlayers: PlayerStat[] = [
  {
    rank: 1,
    player: 'Player One',
    gamertag: 'WigorGT1',
    seasons: 0,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
  },
];

const wigorGoalies: GoalieStat[] = [
  {
    rank: 1,
    player: 'Goalkeeper One',
    gamertag: 'WigorGoalie1',
    seasons: 0,
    games: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    savePercentage: 0,
    shutouts: 0,
  },
];

const wibePlayers: PlayerStat[] = [
  {
    rank: 1,
    player: 'Player One',
    gamertag: 'WibeGT1',
    seasons: 0,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
  },
];

const wibeGoalies: GoalieStat[] = [
  {
    rank: 1,
    player: 'Goalkeeper One',
    gamertag: 'WibeGoalie1',
    seasons: 0,
    games: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    savePercentage: 0,
    shutouts: 0,
  },
];

export const statGroups: StatGroup[] = [
  {
    id: 'organization',
    label: 'Organization',
    title: 'Organization all-time leaders',
    description: 'All-time leaders across the WIDA organization.',
    players: widaPlayers,
    goalies: widaGoalies,
  },
  {
    id: 'wida',
    label: 'Wida',
    title: 'Wida all-time leaders',
    description: 'All-time player and goalkeeper stats for Wida.',
    players: widaPlayers,
    goalies: widaGoalies,
  },
  {
    id: 'wigor',
    label: 'Wigor',
    title: 'Wigor all-time leaders',
    description: 'All-time player and goalkeeper stats for Wigor.',
    players: wigorPlayers,
    goalies: wigorGoalies,
  },
  {
    id: 'wibe',
    label: 'Wibe',
    title: 'Wibe all-time leaders',
    description: 'All-time player and goalkeeper stats for Wibe.',
    players: wibePlayers,
    goalies: wibeGoalies,
  },
];