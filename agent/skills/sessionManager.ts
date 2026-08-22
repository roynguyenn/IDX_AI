import { PropertyFilters } from "./propertyQueryParser";

export interface UserSession {
  city?: string;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  type?: string;
  pool?: string;
  lastResults?: any[];
  lastListingId?: string; 
  conversationStep: number;
}

const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { conversationStep: 0 });
  }
  return sessions.get(userId)!;
}

export function updateSession(userId: string, updates: Partial<UserSession>) {
  const session = getSession(userId);
  sessions.set(userId, { ...session, ...updates });
}

export function clearSession(userId: string) {
  sessions.delete(userId);
}


export function getNextQuestion(session: UserSession): string | null {
  if (!session.city) {
    return "What city are you looking in?";
  }
  if (!session.maxPrice) {
    return "What is your budget?";
  }
  if (!session.type) {
    return "Any preferences — condo, townhome, or single family?";
  }
  if (!session.beds) {
    return "How many bedrooms are you looking for?";
  }
  return null; // we have enough info to search
}