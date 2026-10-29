import Redis from 'ioredis';

/** Reads every field of a hash with HSCAN, so a large hash never blocks Redis the way HGETALL can. */
export async function readHash(
  redis: Redis,
  key: string,
): Promise<Map<string, string>> {
  const fields = new Map<string, string>();
  let cursor = '0';
  do {
    const [next, batch] = await redis.hscan(key, cursor, 'COUNT', 1000);
    cursor = next;
    for (let i = 0; i < batch.length; i += 2) {
      fields.set(batch[i], batch[i + 1]);
    }
  } while (cursor !== '0');
  return fields;
}

/** Sums the numeric values of a counter hash. */
export function sumCounters(counters: Map<string, string>): number {
  let total = 0;
  for (const value of counters.values()) {
    total += Number(value);
  }
  return total;
}
