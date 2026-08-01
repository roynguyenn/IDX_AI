import { query } from "./mlsDataBase";
import { UserSession } from "./sessionManager";

// uses a MySQL database to store user sessions

interface SessionRow {
  user_id: string;
  city: string | null;
  max_price: number | null;
  beds: number | null;
  type: string | null;
  conversation_step: number;
}

export async function getSessionFromDB(userId: string): Promise<UserSession> {
  const rows = await query<SessionRow>("SELECT * FROM sessions WHERE user_id = ?", [userId]);

  if (rows.length === 0) {
    return { conversationStep: 0 };
  }

  const row = rows[0];
  return {
    city: row.city ?? undefined,
    maxPrice: row.max_price ?? undefined,
    beds: row.beds ?? undefined,
    type: row.type ?? undefined,
    conversationStep: row.conversation_step,
  };
}

export async function saveSessionToDB(userId: string, session: UserSession): Promise<void> {
  const sql = `
    INSERT INTO sessions (user_id, city, max_price, beds, type, conversation_step)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      city = VALUES(city),
      max_price = VALUES(max_price),
      beds = VALUES(beds),
      type = VALUES(type),
      conversation_step = VALUES(conversation_step)
  `;
  await query(sql, [
    userId,
    session.city ?? null,
    session.maxPrice ?? null,
    session.beds ?? null,
    session.type ?? null,
    session.conversationStep ?? 0,
  ]);
}

export async function clearSessionInDB(userId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE user_id = ?", [userId]);
}