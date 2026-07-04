const FARMACIAS_SOURCE_URL =
  'https://farmacias-7d813.firebaseio.com/farmacia2/features.json';
const CACHE_TTL_MS = 30 * 60 * 1000;

let cachedPayload: string | null = null;
let cachedAt = 0;

export default async () => {
  try {
    if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) {
      return new Response(cachedPayload, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=1800, stale-while-revalidate=1800',
          'x-farmacias-cache': 'HIT'
        }
      });
    }

    const response = await fetch(FARMACIAS_SOURCE_URL, {
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: 'farmacias_upstream_error',
          status: response.status
        }),
        {
          status: 502,
          headers: {
            'content-type': 'application/json; charset=utf-8'
          }
        }
      );
    }

    const payload = await response.text();
    cachedPayload = payload;
    cachedAt = Date.now();

    return new Response(payload, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=1800, stale-while-revalidate=1800',
        'x-farmacias-cache': 'MISS'
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'farmacias_fetch_failed',
        detail: error instanceof Error ? error.message : 'unknown_error'
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      }
    );
  }
};
