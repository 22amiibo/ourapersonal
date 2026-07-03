import { sql } from "@/lib/db";

// Daily weather sync from Open-Meteo (free, no API key). Mirrors the
// syncOura/syncCalendar shape: skip gracefully without config, reduce the
// response into a per-day map, upsert with a raw_payload blob. Units are
// metric at rest (°C / mm); convert at display time only.

const WEATHER_CODES: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
};

type OpenMeteoDaily = {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  relative_humidity_2m_max?: (number | null)[];
  weathercode: (number | null)[];
};

export async function syncWeather(
  userId: number,
  range?: { start: string; end: string },
): Promise<{ synced: number; skipped?: string }> {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('lat', 'lon')`;
  const map = Object.fromEntries((rows as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const lat = Number(map.lat);
  const lon = Number(map.lon);
  if (!map.lat || !map.lon || Number.isNaN(lat) || Number.isNaN(lon)) {
    return { synced: 0, skipped: "no location configured" };
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max,weathercode",
    timezone: "auto",
  });
  if (range) {
    params.set("start_date", range.start);
    params.set("end_date", range.end);
  }

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as { daily?: OpenMeteoDaily };
  const daily = data.daily;
  if (!daily?.time?.length) return { synced: 0, skipped: "empty response" };

  let synced = 0;
  for (let i = 0; i < daily.time.length; i++) {
    const day = daily.time[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const code = daily.weathercode[i];
    const payload = {
      temp_hi: daily.temperature_2m_max[i],
      temp_lo: daily.temperature_2m_min[i],
      precip_mm: daily.precipitation_sum[i],
      humidity: daily.relative_humidity_2m_max?.[i] ?? null,
      weathercode: code,
    };
    await sql`
      INSERT INTO weather_daily (user_id, day, temp_hi, temp_lo, humidity, condition, precip_mm, raw_payload, synced_at)
      VALUES (${userId}, ${day}, ${payload.temp_hi}, ${payload.temp_lo}, ${payload.humidity},
              ${code != null ? WEATHER_CODES[code] ?? String(code) : null}, ${payload.precip_mm},
              ${JSON.stringify(payload)}, NOW())
      ON CONFLICT (user_id, day) DO UPDATE
        SET temp_hi = EXCLUDED.temp_hi, temp_lo = EXCLUDED.temp_lo,
            humidity = EXCLUDED.humidity, condition = EXCLUDED.condition,
            precip_mm = EXCLUDED.precip_mm, raw_payload = EXCLUDED.raw_payload,
            synced_at = NOW()`;
    synced++;
  }
  return { synced };
}

export type WeatherDay = {
  day: string;
  temp_hi: number | null;
  temp_lo: number | null;
  condition: string | null;
};

// Recent stored weather, oldest→newest, for compact strips next to trend charts.
export async function getRecentWeather(userId: number, days = 14): Promise<WeatherDay[]> {
  try {
    const rows = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, temp_hi::float8, temp_lo::float8, condition
      FROM weather_daily
      WHERE user_id = ${userId} AND day <= CURRENT_DATE
      ORDER BY day DESC LIMIT ${days}`;
    return (rows as WeatherDay[]).reverse();
  } catch {
    return [];
  }
}
