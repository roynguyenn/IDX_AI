import nodemailer from "nodemailer";
import { execSync } from "child_process";
import * as path from "path";
import { UserSession, EmailDraft } from "./sessionManager";
import { searchActiveListings } from "./mlsDataBase";

const PYTHON = `"${path.join(__dirname, "..", "..", "venv", "Scripts", "python.exe")}"`;

export interface DraftResult {
  draft: EmailDraft;
  status: "pending_approval";
}

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
  }
  return transporter;
}

// STEP 1: Draft — never send without approval
export async function draftEmail(to: string, subject: string, body: string): Promise<DraftResult> {
  return { draft: { to, subject, body }, status: "pending_approval" };
}

// STEP 2: Send only after explicit human confirmation
export async function sendApprovedEmail(draft: EmailDraft): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error("EMAIL_USER/EMAIL_PASSWORD not configured in .env — cannot send.");
  }
  await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: draft.to,
    subject: draft.subject,
    html: draft.body,
  });
}

function getWeeklyMarketReportText(): string {
  // PYTHONIOENCODING forces UTF-8 stdout — Python defaults to the Windows console codepage
  // otherwise, which mangles non-ASCII characters like the em dash in the report title.
  const output = execSync(
    `cd ../../analytics && ${PYTHON} -c "from rag import generate_market_summary_doc; doc = generate_market_summary_doc(); print(doc['content'])"`,
    { encoding: "utf-8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } }
  );
  return output.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function buildWeeklyMarketReportDraft(to: string): Promise<DraftResult> {
  const text = getWeeklyMarketReportText();
  const html = `<h2>IDX Weekly Market Report</h2><pre>${escapeHtml(text)}</pre>`;
  return draftEmail(to, "IDX Weekly Market Report", html);
}

// caps at 5 listings (well under the ≤50-row export limit) — an alert digest, not a data dump
export async function buildListingAlertDraft(to: string, session: UserSession): Promise<DraftResult> {
  const listings = await searchActiveListings(
    { city: session.city, maxPrice: session.maxPrice, beds: session.beds, type: session.type },
    1,
    5
  );

  if (listings.length === 0) {
    return draftEmail(to, "IDX New Listing Alert", "<p>No matching listings found right now.</p>");
  }

  const rows = listings
    .map(
      (l: any) =>
        `<li><b>${l.L_Address}, ${l.L_City}</b> — $${Number(l.price).toLocaleString()} | ${l.beds}bd/${l.baths}ba | ${l.sqft} sqft</li>`
    )
    .join("");

  const html = `<h2>New Listings Matching Your Search</h2><ul>${rows}</ul>`;
  return draftEmail(to, "IDX New Listing Alert", html);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\/(li|h2|pre)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
