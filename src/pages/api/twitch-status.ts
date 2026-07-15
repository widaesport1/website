import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type TwitchStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

const getEnvValue = (key: string) => {
  const runtimeEnv = env as Record<string, string | undefined>;

  return runtimeEnv[key] ?? import.meta.env[key];
};

const getTwitchAccessToken = async (
  clientId: string,
  clientSecret: string
) => {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitch token request failed: ${errorText}`);
  }

  const data = (await response.json()) as TwitchTokenResponse;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
};

const getTwitchStream = async (
  channel: string,
  clientId: string,
  accessToken: string
) => {
  const url = new URL('https://api.twitch.tv/helix/streams');

  url.searchParams.set('user_login', channel);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitch stream request failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    data: TwitchStream[];
  };

  return data.data[0] ?? null;
};

export const GET: APIRoute = async () => {
  try {
    const clientId = getEnvValue('TWITCH_CLIENT_ID');
    const clientSecret = getEnvValue('TWITCH_CLIENT_SECRET');
    const channel = getEnvValue('TWITCH_CHANNEL');

    if (!clientId || !clientSecret || !channel) {
      throw new Error(
        'Missing TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, or TWITCH_CHANNEL'
      );
    }

    const accessToken = await getTwitchAccessToken(clientId, clientSecret);
    const stream = await getTwitchStream(channel, clientId, accessToken);

    return new Response(
      JSON.stringify({
        channel,
        live: Boolean(stream),
        stream: stream
          ? {
              title: stream.title,
              game: stream.game_name,
              viewers: stream.viewer_count,
              startedAt: stream.started_at,
              thumbnail: stream.thumbnail_url
                .replace('{width}', '640')
                .replace('{height}', '360'),
              url: `https://www.twitch.tv/${channel}`,
            }
          : null,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error while checking Twitch status';

    return new Response(
      JSON.stringify({
        error: message,
        live: false,
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