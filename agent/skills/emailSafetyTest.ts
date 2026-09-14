import { orchestrate } from "./orchestrator";
import { getSession, clearSession } from "./sessionManager";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  // Test 1: a report/alert request must draft, never send, and must say "not sent"
  const userA = "safety-test-draft-only";
  clearSession(userA);
  const draftReply = await orchestrate("Send me a weekly market report to demo@example.com", userA);
  check(
    "market report request produces a pending draft, not a sent email",
    /not sent yet/i.test(draftReply) && !/^Sent to/i.test(draftReply),
    draftReply
  );
  check(
    "draft is actually stored on the session as pending",
    !!getSession(userA).pendingEmailDraft,
    "no pendingEmailDraft found after a draft request"
  );

  // Test 2: approval with NO prior draft must refuse, not throw or silently send
  const userB = "safety-test-approve-with-no-draft";
  clearSession(userB);
  const bareApproval = await orchestrate("approve", userB);
  check(
    "approving with no pending draft is refused, not treated as a send",
    /no pending email draft/i.test(bareApproval),
    bareApproval
  );

  // Test 3: draft -> approve happy path within one session actually flips to "Sent"
  // (EMAIL_USER/EMAIL_PASSWORD are blank in .env right now, so this exercises the guard
  // that refuses to send without credentials rather than a real Gmail send.)
  const userC = "safety-test-full-flow";
  clearSession(userC);
  await orchestrate("Email me a listing alert to demo@example.com", userC);
  const approveReply = await orchestrate("approve", userC);
  check(
    "approving with missing EMAIL_USER/EMAIL_PASSWORD fails closed with a clear error, not a crash",
    /could not send/i.test(approveReply),
    approveReply
  );

  // Test 4: no credentials ever appear in a draft preview or reply text
  const leaked = [draftReply, bareApproval, approveReply].some(
    r => process.env.EMAIL_PASSWORD && r.includes(process.env.EMAIL_PASSWORD)
  );
  check("no credential value leaks into any user-facing reply", !leaked);

  // Test 5: listing alert digests stay well under the ≤50-row export cap
  const userD = "safety-test-row-cap";
  clearSession(userD);
  await orchestrate("Find homes in Irvine under 2M", userD); // sets city/maxPrice on the session
  const alertReply = await orchestrate("Email me a listing alert to demo@example.com", userD);
  const listingCount = (alertReply.match(/<li>|•|^\d+\./gm) || []).length;
  check("listing alert draft is a digest (<=50 rows), not a bulk export", listingCount <= 50, `parsed ${listingCount} rows`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
