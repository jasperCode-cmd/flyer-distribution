This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CRM: Gmail sending

The CRM sends and reads email through one shared Gmail mailbox
(`flyerdistributionhampshire@gmail.com`), connected once with Google OAuth.

### One-time setup

1. In Google Cloud Console, create an OAuth client of type "Desktop app" and
   enable the Gmail API for the project.
2. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GMAIL_SENDER_ADDRESS`
   to `.env.local`.
3. Run the authorisation script yourself, locally:
   ```bash
   node scripts/gmail-authorise.mjs
   ```
   It prints a Google sign-in URL. Open it, sign in as the shared mailbox,
   and grant access. The script checks the signed-in address matches
   `GMAIL_SENDER_ADDRESS` and, only if it matches, writes
   `GMAIL_REFRESH_TOKEN` into `.env.local`. It never prints the token.
4. If Gmail should ignore mail to or from certain addresses in the CRM's
   conversation view, set `GMAIL_EXCLUDE_ADDRESSES` to a comma separated
   list.

### Adding the variables in Vercel

In the Vercel project's Environment Variables settings, add all four:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`,
`GMAIL_SENDER_ADDRESS` (and `GMAIL_EXCLUDE_ADDRESSES` if used). Mark each one
**Sensitive**, and apply them to both **Production** and **Preview**
environments. Without these, the CRM still works, it just shows a
"Gmail is not connected" state wherever sending or reading email would
otherwise happen.
