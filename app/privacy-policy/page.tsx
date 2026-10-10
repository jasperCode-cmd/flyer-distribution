import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Flyer Distribution Hampshire collects, uses and looks after your personal information, and your rights under UK data protection law.",
  alternates: {
    canonical: "https://www.flyerdistributionhampshire.co.uk/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy",
    description:
      "How Flyer Distribution Hampshire collects, uses and looks after your personal information, and your rights under UK data protection law.",
    url: "https://www.flyerdistributionhampshire.co.uk/privacy-policy",
    siteName: "Flyer Distribution Hampshire",
    images: [
      {
        url: "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
        width: 1200,
        height: 630,
        alt: "Flyer Distribution Hampshire",
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy",
    description:
      "How Flyer Distribution Hampshire collects, uses and looks after your personal information, and your rights under UK data protection law.",
    images: [
      "https://images.pexels.com/photos/35110918/pexels-photo-35110918.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.flyerdistributionhampshire.co.uk",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Privacy Policy",
      item: "https://www.flyerdistributionhampshire.co.uk/privacy-policy",
    },
  ],
};

const EMAIL = "flyerdistributionhampshire@gmail.com";

/* Shared styles */
const a = "text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors";
const card = "bg-white border border-gray-200 rounded-lg p-6 sm:p-8";
const h2 = "text-xl font-bold text-blue-900 mb-4";
const h3 = "text-base font-semibold text-gray-800 mb-2";
const p = "text-gray-600 leading-relaxed";
const ul = "list-disc pl-5 text-gray-600 leading-relaxed";

function EmailLink() {
  return (
    <a href={`mailto:${EMAIL}`} className={`${a} wrap-break-word`}>
      {EMAIL}
    </a>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Privacy Policy" },
            ]}
          />
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-blue-200 text-lg max-w-2xl leading-relaxed">
            Your privacy matters to us. This page explains what personal
            information Flyer Distribution Hampshire collects through this
            website, why we collect it, and what we do with it. We&apos;ve kept
            it as short and plain as we can. If anything isn&apos;t clear, just
            email us and we&apos;ll happily explain.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4">

          {/* Who we are */}
          <div className={card}>
            <h2 className={h2}>Who we are</h2>
            <p className={p}>
              Flyer Distribution Hampshire is an independent leaflet
              distribution and marketing business based in Ringwood and serving
              Hampshire and Dorset. We are run as a partnership between Jasper
              Adams and Daniel Whitby. We are responsible for the personal information
              described on this page (in data protection terms, we are the
              &ldquo;controller&rdquo;).
            </p>
            <ul className={`${ul} space-y-1.5 mt-4`}>
              <li>Email: <EmailLink /></li>
              <li>Address: 11 Forest Reach, St Leonards, Ringwood, BH24 2NR</li>
            </ul>
          </div>

          {/* What we collect and why */}
          <div className={card}>
            <h2 className={h2}>What we collect and why</h2>

            <h3 className={h3}>When you ask for a quote</h3>
            <p className={`${p} mb-2`}>Our quote form asks for:</p>
            <ul className={`${ul} space-y-1.5`}>
              <li>your name</li>
              <li>your email address and phone number</li>
              <li>your company or organisation (optional)</li>
              <li>
                the service you&apos;re interested in and details of your
                campaign, project or event, such as target areas or postcodes,
                quantities, dates, event location and your rough budget
              </li>
              <li>anything else you choose to tell us in the additional details box</li>
              <li>whether you&apos;d like to hear tips and offers from us</li>
            </ul>
            <p className={`${p} mt-3`}>
              We use this to reply to you, put your quote together and, if you
              go ahead, plan and carry out the work. We add your enquiry to our
              own records so we can keep track of it and follow it up, and we
              check whether you&apos;ve been in touch before so we don&apos;t
              end up with duplicate records. If you become a customer, we also
              keep a record of the work and payments, and once the job is done
              we may ask how it went and whether you&apos;d leave us a review.
            </p>

            <h3 className={`${h3} mt-6`}>When you apply to deliver leaflets for us</h3>
            <p className={`${p} mb-2`}>Our Work With Us form asks for:</p>
            <ul className={`${ul} space-y-1.5`}>
              <li>your full name</li>
              <li>your phone number</li>
              <li>your email address (optional)</li>
              <li>where you live (town or postcode)</li>
              <li>your age</li>
              <li>whether you have access to a car and a full UK driving licence</li>
              <li>when you&apos;re available</li>
            </ul>
            <p className={`${p} mt-3`}>
              We use this to look at your application and get back to you about
              it, most likely by message using the phone number you gave us. If
              you start delivering for us, we keep your name, contact details
              and notes in our records so we can organise your rounds.
            </p>
            <p className={`${p} mt-3`}>
              <strong className="font-semibold text-gray-800">Young people.</strong>{" "}
              You can apply to deliver for us if you&apos;re under 18. If you
              are, please ask a parent or guardian to read this page with you.
              We may need to speak to them before you start.
            </p>

            <h3 className={`${h3} mt-6`}>Emails</h3>
            <p className={p}>
              If you email us, or we email you, we keep those emails and notes
              about the conversation so we can answer you and keep track of
              where things are up to. Our private system connects to our own
              business email account only to send emails from our records and
              to show us our conversations with the people in them.
            </p>

            <h3 className={`${h3} mt-6`}>Tips and offers</h3>
            <p className={p}>
              If you tick the box on our quote form, we may get in touch with
              tips and offers from Flyer Distribution Hampshire. You can change
              your mind at any time by emailing us, and we&apos;ll stop.
            </p>

            <h3 className={`${h3} mt-6`}>When you visit the website</h3>
            <p className={p}>
              Like any website, when you visit, the providers that host and
              deliver it receive technical details such as your IP address, the
              type of browser you&apos;re using and the page you asked for.
              They need this to send the page to your device and to help keep
              the site secure. We don&apos;t use analytics, advertising or
              tracking tools on this website.
            </p>
          </div>

          {/* Lawful basis */}
          <div className={card}>
            <h2 className={h2}>Our lawful basis for using your information</h2>
            <p className={`${p} mb-3`}>
              UK data protection law says we need a lawful basis (a valid legal
              reason) for each way we use your information. Here are ours:
            </p>
            <ul className={`${ul} space-y-3`}>
              <li>
                <strong className="font-semibold text-gray-800">
                  Replying to your quote request, preparing your quote and
                  carrying out the work you book:
                </strong>{" "}
                this is necessary to take steps you&apos;ve asked for before we
                agree a contract, and then to carry out that contract.
              </li>
              <li>
                <strong className="font-semibold text-gray-800">
                  Looking at your application to deliver for us and getting in
                  touch about it:
                </strong>{" "}
                this is necessary to take steps you&apos;ve asked for before we
                agree to work together, and then to carry out that agreement.
              </li>
              <li>
                <strong className="font-semibold text-gray-800">
                  Keeping records of enquiries, applications and our emails,
                  following things up, avoiding duplicate records and asking for
                  a review after a job:
                </strong>{" "}
                our legitimate interests in running our business properly and
                answering people well. We think these are uses you&apos;d
                reasonably expect from a business you&apos;ve contacted.
              </li>
              <li>
                <strong className="font-semibold text-gray-800">
                  Sending tips and offers:
                </strong>{" "}
                your consent, which you give by ticking the box. You can
                withdraw it at any time.
              </li>
              <li>
                <strong className="font-semibold text-gray-800">
                  Keeping records of work and payments:
                </strong>{" "}
                to meet our legal obligations, such as keeping proper business
                and tax records.
              </li>
              <li>
                <strong className="font-semibold text-gray-800">
                  Delivering this website and keeping it secure:
                </strong>{" "}
                our legitimate interests in running a website that works and is
                safe to use.
              </li>
            </ul>
          </div>

          {/* Who we share it with */}
          <div className={card}>
            <h2 className={h2}>Who we share it with</h2>
            <p className={`${p} mb-3`}>
              We share your information only where we need to in order to run
              the business, with:
            </p>
            <ul className={`${ul} space-y-1.5`}>
              <li>
                our website hosting and delivery providers, which run this
                website and store our records
              </li>
              <li>
                our form-handling provider, which receives what you type into
                our forms and passes it on to us
              </li>
              <li>our email provider, which handles the emails we send and receive</li>
              <li>
                the messaging app we use to contact people who apply to deliver
                for us
              </li>
            </ul>
            <p className={`${p} mt-3`}>
              We may also share information where the law requires us to.
            </p>
          </div>

          {/* How long we keep it */}
          <div className={card}>
            <h2 className={h2}>How long we keep it</h2>
            <p className={`${p} mb-3`}>
              We keep your information for no longer than we need it for the
              purpose we collected it for. Those purposes are:
            </p>
            <ul className={`${ul} space-y-1.5`}>
              <li>answering your enquiry and giving you a quote</li>
              <li>
                carrying out any work you book with us and dealing with any
                questions about it afterwards
              </li>
              <li>
                considering your application to deliver for us and, if you do,
                organising your rounds
              </li>
              <li>keeping the business and tax records the law requires</li>
              <li>sending you tips and offers, until you ask us to stop</li>
            </ul>
            <p className={`${p} mt-3`}>
              We review our records from time to time and delete information we
              no longer need.
            </p>
          </div>

          {/* International transfers */}
          <div className={card}>
            <h2 className={h2}>International transfers</h2>
            <p className={p}>
              Some of the providers we use are based outside the UK, or may
              store or process information outside the UK. Where that happens,
              our providers rely on safeguards that UK data protection law
              recognises, such as UK adequacy regulations or approved contract
              terms. If you&apos;d like to know more, just email us.
            </p>
          </div>

          {/* Your rights */}
          <div className={card}>
            <h2 className={h2}>Your rights</h2>
            <p className={`${p} mb-3`}>You have the right to:</p>
            <ul className={`${ul} space-y-1.5`}>
              <li>
                <strong className="font-semibold text-gray-800">Access:</strong>{" "}
                ask for a copy of the personal information we hold about you
              </li>
              <li>
                <strong className="font-semibold text-gray-800">Correct:</strong>{" "}
                ask us to fix anything that&apos;s wrong or incomplete
              </li>
              <li>
                <strong className="font-semibold text-gray-800">Erase:</strong>{" "}
                ask us to delete your information
              </li>
              <li>
                <strong className="font-semibold text-gray-800">Restrict:</strong>{" "}
                ask us to limit how we use it
              </li>
              <li>
                <strong className="font-semibold text-gray-800">Object:</strong>{" "}
                object to us using it, including for tips and offers at any time
              </li>
              <li>
                <strong className="font-semibold text-gray-800">Portability:</strong>{" "}
                ask for the information you gave us in a format you can reuse,
                where this applies
              </li>
            </ul>
            <p className={`${p} mt-3`}>
              Where we rely on your consent, you can withdraw it at any time.
              Some of these rights depend on why we&apos;re using your
              information, and we&apos;ll explain if one doesn&apos;t apply.
            </p>
            <p className={`${p} mt-3`}>
              To use any of these rights, email us at <EmailLink />. There&apos;s
              usually no charge, and we&apos;ll reply within one month. We may
              need to ask you to confirm who you are first.
            </p>
          </div>

          {/* How to complain */}
          <div className={card}>
            <h2 className={h2}>How to complain</h2>
            <p className={p}>
              If you&apos;re unhappy with how we&apos;ve handled your
              information, please tell us first and we&apos;ll do our best to
              put it right. You also have the right to complain to the
              Information Commissioner&apos;s Office (ICO), the UK&apos;s data
              protection regulator, at{" "}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className={a}
              >
                ico.org.uk
              </a>
              .
            </p>
          </div>

          {/* Cookies and storage */}
          <div className={card}>
            <h2 className={h2}>Cookies and storage</h2>
            <p className={p}>
              The public pages of this website don&apos;t set any cookies.
            </p>
            <p className={`${p} mt-3`}>
              We store one small thing in your browser. When you close the
              pop-up about our campaign slots, your browser&apos;s session
              storage remembers that, so the pop-up doesn&apos;t keep coming
              back as you look around the site. It only records that the pop-up
              was closed, it isn&apos;t linked to you and it isn&apos;t sent to
              us. Your browser clears it when you close the tab.
            </p>
            <p className={`${p} mt-3`}>
              Our private staff login area uses cookies that keep the sign-in
              secure and keep our team signed in. They&apos;re only set if
              someone opens the staff login pages.
            </p>
          </div>

          {/* Contact us */}
          <div className={card}>
            <h2 className={h2}>Contact us</h2>
            <p className={`${p} mb-3`}>
              If you have any questions about this policy or how we use your
              information, we&apos;d love to hear from you:
            </p>
            <ul className={`${ul} space-y-1.5`}>
              <li>Email: <EmailLink /></li>
              <li>
                Post: Flyer Distribution Hampshire, 11 Forest Reach, St
                Leonards, Ringwood, BH24 2NR
              </li>
            </ul>
            <p className={`${p} mt-4 text-sm`}>
              This policy was written on 10 October 2026. If we change how we
              use personal information, we&apos;ll update this page.
            </p>
          </div>

        </div>
      </section>
    </>
  );
}
