// User service — business logic layer.
// Should talk to DB through a repository abstraction, NOT import db directly.

import { db } from "../db/client"; // VIOLATION: services -> db

export async function getUser(id: string) {
  const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`);
  return rows[0] ?? null;
}

export async function listUsers() {
  return db.query("SELECT * FROM users ORDER BY created_at DESC");
}

