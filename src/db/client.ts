// Database client module — the lowest layer in the architecture.

export interface DbConnection {
  query(sql: string): Promise<unknown[]>;
}

export function createDbClient(): DbConnection {
  return {
    async query(sql: string) {
      // In a real app this would call pg/mysql/etc.
      console.log(`[db] ${sql}`);
      return [];
    },
  };
}

export const db = createDbClient();

