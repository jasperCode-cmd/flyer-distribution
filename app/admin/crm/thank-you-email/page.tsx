import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { campaignSlots } from "@/lib/campaign-constants";
import { buildThankYouEmail, type QuoteEnquiry } from "@/lib/thank-you-email";
import EmailPreviewFrame from "@/components/crm/EmailPreviewFrame";

export const dynamic = "force-dynamic";

// The automatic thank-you email a website quote enquiry gets, shown with
// made-up details, so it can be checked without sending anything. Its
// images come from this site, as the real email's do from the live one.
const SAMPLE: QuoteEnquiry = {
  firstName: "Sarah",
  service: "Leaflet Distribution",
  targetAreas: "Ringwood, Ferndown and BH24",
  quantity: "5,000 - 10,000",
  startDate: "2026-11-16",
  printingIncluded: "yes",
  designIncluded: null,
};

export default async function ThankYouEmailPreviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/crm/login");
  const email = buildThankYouEmail(SAMPLE, campaignSlots, "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Thank-you email preview</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Sent automatically from the business Gmail to each Flyer Distribution Hampshire Leaflet Distribution quote enquiry from the
          website (not Web Design &amp; SEO or Screen Hire), at most once per email address in 24 hours. Shown here with made-up details; nothing is sent from this page. The slots line follows
          lib/campaign-constants.ts and is left out when no slots are left.
        </p>
      </div>
      <dl className="bg-white rounded-lg border border-gray-200 p-4 text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
        <dt className="text-gray-500">Subject</dt>
        <dd className="text-gray-900 font-medium">{email.subject}</dd>
        <dt className="text-gray-500">Preview text</dt>
        <dd className="text-gray-900">{email.preheader}</dd>
        <dt className="text-gray-500">Sample</dt>
        <dd className="text-gray-900">
          {SAMPLE.firstName}, {SAMPLE.targetAreas}, {SAMPLE.quantity} leaflets, starting {SAMPLE.startDate}, printing included
        </dd>
      </dl>
      <div className="flex flex-wrap items-start gap-6">
        <EmailPreviewFrame title="As sent, 600px wide" html={email.html} width={640} />
        <EmailPreviewFrame title="On a phone, 375px wide" html={email.html} width={375} />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-blue-900 mb-2">Plain-text version</h2>
        <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{email.text}</pre>
      </div>
    </div>
  );
}
