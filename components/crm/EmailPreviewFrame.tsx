"use client";

import { useRef, useState } from "react";

// An email's HTML in its own frame, so the page's styles and the email's
// never mix, grown to the email's full height once it has loaded.
export default function EmailPreviewFrame({ title, html, width }: { title: string; html: string; width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1600);

  function fit() {
    const doc = ref.current?.contentDocument;
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  }

  return (
    <figure className="min-w-0 max-w-full">
      <figcaption className="text-xs font-medium text-gray-500 mb-1.5">{title}</figcaption>
      <iframe
        ref={ref}
        title={title}
        srcDoc={html}
        onLoad={() => {
          fit();
          // Images can change the height after the first load.
          setTimeout(fit, 500);
        }}
        style={{ width, height }}
        className="max-w-full rounded-lg border border-gray-200 bg-white"
      />
    </figure>
  );
}
