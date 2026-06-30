import Image from "next/image";

const Stars = () => (
  <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        className="w-4 h-4 text-amber-400"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

export default function Testimonials() {
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-12">
          What People Say About Us
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

          {/* Card 1 — Body by Victoria */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/Body by Victoria.png"
                alt="Body by Victoria logo"
                width={913}
                height={534}
                className="h-14 w-auto object-contain"
              />
            </div>
            <Stars />
            <blockquote className="text-gray-600 text-sm leading-relaxed mb-3">
              &ldquo;Great communication from the start. Very polite competitive prices will definitely be using again. Thank you&rdquo;
            </blockquote>
            <div>
              <p className="text-blue-900 font-semibold text-sm">Body by Victoria</p>
              <p className="text-gray-400 text-xs mt-0.5">Google Review</p>
            </div>
          </div>

          {/* Card 2 — Kola Construction */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
            {/* Badges flanking the logo with clear separation, bottom-aligned */}
            <div className="flex items-end justify-between mb-4">
              <Image
                src="/grand designs live.webp"
                alt="Grand Designs Live exhibitor badge"
                width={200}
                height={100}
                className="h-14 w-auto object-contain shrink-0"
              />
              <Image
                src="/KOLA-CONSTRUCTION-LOGO.webp"
                alt="Kola Construction logo"
                width={200}
                height={80}
                className="h-16 w-auto object-contain shrink-0"
              />
              <Image
                src="/logo_exhibitor_default.webp"
                alt="Ideal Home Show exhibitor badge"
                width={200}
                height={100}
                className="h-8 w-auto object-contain shrink-0"
              />
            </div>
            <Stars />
            <blockquote className="text-gray-600 text-sm leading-relaxed mb-3">
              &ldquo;Excellent flyer distribution service from start to finish. The team was professional, reliable, and kept us updated throughout the campaign.&rdquo;
            </blockquote>
            <div>
              <p className="text-blue-900 font-semibold text-sm">Kola Construction</p>
              <p className="text-gray-400 text-xs mt-0.5">Google Review</p>
            </div>
          </div>

          {/* Card 3 — Cozy Stoves */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/Cozy-Stoves-logo.png"
                alt="Cozy Stoves logo"
                width={305}
                height={100}
                className="h-14 w-auto object-contain"
              />
            </div>
            <Stars />
            <blockquote className="text-gray-600 text-sm leading-relaxed mb-3">
              &ldquo;Fast and reliable team service all around&rdquo;
            </blockquote>
            <div>
              <p className="text-blue-900 font-semibold text-sm">Cozy Stoves</p>
              <p className="text-gray-400 text-xs mt-0.5">Client review</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
