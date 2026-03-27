import { query } from "../db/client";

export function getUser(id: string): string {
  return query(`SELECT * FROM users WHERE id = '${id}'`);
}
