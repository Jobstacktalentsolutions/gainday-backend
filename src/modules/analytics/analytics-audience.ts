import { Audience } from '../../db/schema';

const AUDIENCES: string[] = Object.values(Audience);

/** Rejects a value Redis holds that the schema does not know, rather than writing it through. */
export function toAudience(value: string): Audience {
  if (!AUDIENCES.includes(value)) {
    throw new Error(`Unknown visitor audience "${value}"`);
  }
  return value as Audience;
}
