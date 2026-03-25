// API handler — the top layer.
// Should only depend on services, never reach down to db directly.

import { db } from "../db/client";              // VIOLATION: api -> db
import { getUser } from "../services/userService"; // VIOLATION: api -> services

export async function handleGetUser(req: any, res: any) {
  const user = await getUser(req.params.id);
  res.json(user);
}

export async function handleGetUserMeta(req: any, res: any) {
  // Direct DB access — architectural shortcut that Truss should catch.
  const meta = await db.query(
    `SELECT * FROM user_meta WHERE uid = '${req.params.id}'`,
  );
  res.json(meta);
}

