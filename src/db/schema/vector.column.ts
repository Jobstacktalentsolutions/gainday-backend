import { customType } from 'drizzle-orm/pg-core';

export const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(',')
        .map((v) => Number(v));
    },
  })(name);

// Half-precision vector: same wire format as `vector`, but pgvector stores
// each dimension as a 16-bit float. Needed for HNSW indexes above 2000 dims
// (HNSW on `vector` caps at 2000; `halfvec` raises that to 4000), and uses
// half the storage. See https://github.com/pgvector/pgvector#half-precision-vectors
export const halfvec = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `halfvec(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(',')
        .map((v) => Number(v));
    },
  })(name);
