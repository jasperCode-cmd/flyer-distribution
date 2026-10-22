import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { campaignSlots } from "@/lib/campaign-constants";
import { buildThankYouEmail, type QuoteEnquiry } from "@/lib/thank-you-email";
import { buildApplicantThankYouEmail, type ApplicantDetails } from "@/lib/applicant-thank-you-email";
import EmailPreviewFrame from "@/components/crm/EmailPreviewFrame";

export const dynamic = "force-dynamic";

// The automatic thank-you emails, shown with made-up details, so they can be
// checked without sending anything: the one a website quote enquiry gets,
// and the one a distributor applicant gets (once as an adult, once under
// 18). Their images come from this site, as the real emails' do from the
// live one.
const SAMPLE: QuoteEnquiry = {
  firstName: "Sarah",
  service: "Leaflet Distribution",
  targetAreas: "Ringwood, Ferndown and BH24",
  quantity: "5,000 - 10,000",
  startDate: "2026-11-16",
  printingIncluded: "yes",
  designIncluded: null,
};

const APPLICANTS: { label: string; details: ApplicantDetails }[] = [
  {
    label: "Aged 24",
    details: {
      fullName: "Jamie Carter",
      area: "Ferndown, BH22",
      age: "24",
      hasCar: true,
      hasLicence: true,
      availability: "Weekday afternoons\nSaturdays",
    },
  },
  {
    label: "Aged 16, with the under-18 note",
    details: {
      fullName: "Ellie Morgan",
      area: "Ringwood",
      age: "16",
      hasCar: false,
      hasLicence: false,
      availability: "Weekends and school holidays",
    },
  },
];

const yesNo = (value: boolean | null | undefined) => (value ? "car" : "no car");

export default async function ThankYouEmailPreviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/crm/login");
  const email = buildThankYouEmail(SAMPLE, campaignSlots, "");
  const applicantEmails = APPLICANTS.map((a) => ({ ...a, email: buildApplicantThankYouEmail(a.details, "") }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Thank-you email previews</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          The automatic emails sent from the business Gmail, shown here with made-up details; nothing is sent from this page.
        </p>
      </div>

      <h2 className="text-lg font-bold text-blue-900 pt-2">Quote enquiry</h2>
      <p className="text-sm text-gray-600 max-w-3xl">
        Sent automatically to each Flyer Distribution Hampshire Leaflet Distribution quote enquiry from the website (not Web Design &amp;
        SEO or Screen Hire), at most once per email address in 24 hours. The slots line follows lib/campaign-constants.ts and is left
        out when no slots are left.
      </p>
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

      <h2 className="text-lg font-bold text-blue-900 pt-6">Distributor applicant</h2>
      <p className="text-sm text-gray-600 max-w-3xl">
        Sent automatically to each Flyer Distribution Hampshire Work With Us application that gives an email address, at most once
        per email address in 24 hours; never for Bournemouth applications or ones brought in by the Gmail import. It changes nothing
        about the application. The under-18 note is only included when the age given is a number under 18, and the age itself is
        never shown.
      </p>
      {applicantEmails.map(({ label, details, email: applicant }) => (
        <div key={label} className="space-y-4">
          <h3 className="text-base font-bold text-blue-900">{label}</h3>
          <dl className="bg-white rounded-lg border border-gray-200 p-4 text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
            <dt className="text-gray-500">Subject</dt>
            <dd className="text-gray-900 font-medium">{applicant.subject}</dd>
            <dt className="text-gray-500">Preview text</dt>
            <dd className="text-gray-900">{applicant.preheader}</dd>
            <dt className="text-gray-500">Sample</dt>
            <dd className="text-gray-900">
              {details.fullName}, aged {details.age}, {details.area}, {yesNo(details.hasCar)}, {details.hasLicence ? "full UK licence" : "no licence"}
            </dd>
          </dl>
          <div className="flex flex-wrap items-start gap-6">
            <EmailPreviewFrame title="As sent, 600px wide" html={applicant.html} width={640} />
            <EmailPreviewFrame title="On a phone, 375px wide" html={applicant.html} width={375} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-blue-900 mb-2">Plain-text version</h2>
            <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{applicant.text}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
