import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { handleApplicationRequest } from "@/lib/application-endpoint";
import { sendApplicantThankYou } from "@/lib/applicant-thank-you";
import { senderFor } from "@/lib/email-channel";
import { createRateLimiter } from "@/lib/rate-limit";
import { clearSharedCaches } from "@/lib/shared-cache";

// Called by the public Work With Us form after Web3Forms has accepted the
// application, alongside (never instead of) the email. Public by design, so
// it checks no session; the form ignores whatever this returns.
const allow = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(req: Request) {
  const res = await handleApplicationRequest(req, {
    db: prisma,
    allow,
    // The automatic thank-you email, sent from the business Gmail after this
    // reply, best effort: it never changes what the form is told
    // (lib/applicant-thank-you.ts).
    onSaved: (application) =>
      waitUntil(
        sendApplicantThankYou({ db: prisma, application, send: senderFor("FDH") }).catch(() => {
          console.error("Applicant thank-you email not sent: error");
        })
      ),
  });
  // The bell's shared copy, so it shows at the next ask (lib/shared-cache.ts).
  if (res.ok) clearSharedCaches();
  return res;
}
