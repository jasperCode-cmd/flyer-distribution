#!/usr/bin/env node
// One-time Gmail OAuth setup for the CRM's shared mailbox.
//
// Run this yourself, in a plain terminal, on your own machine:
//   node scripts/gmail-authorise.mjs
//
// It reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from .env.local, opens
// a loopback server on a free local port, prints a Google sign-in URL for
// you to open, exchanges the returned code for a refresh token, and checks
// that the signed-in mailbox matches GMAIL_SENDER_ADDRESS before saving
// anything. The refresh token itself is never printed or logged, only
// written into .env.local.

import { config as loadEnv } from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { gmail as gmailClient } from "@googleapis/gmail";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");

loadEnv({ path: envPath });

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const expectedSender = process.env.GMAIL_SENDER_ADDRESS;

if (!clientId || !clientSecret) {
  console.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local before running this.");
  process.exit(1);
}
if (!expectedSender) {
  console.error("GMAIL_SENDER_ADDRESS must be set in .env.local before running this.");
  process.exit(1);
}

function startLoopbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Authorisation was not granted. You can close this tab.");
        server.emit("auth-error", error);
        return;
      }
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorisation code received. You can close this tab.");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Gmail authorisation received. You can close this tab and return to the terminal.");
      server.emit("auth-code", code);
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on("error", reject);
  });
}

async function main() {
  const { server, port } = await startLoopbackServer();
  const redirectUri = `http://127.0.0.1:${port}`;
  const oauth2Client = new OAuth2Client({ clientId, clientSecret, redirectUri });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nOpen this URL in a browser signed in as the CRM's Gmail account:\n");
  console.log(authUrl);
  console.log("\nWaiting for you to complete sign-in...\n");

  const code = await new Promise((resolve, reject) => {
    server.once("auth-code", resolve);
    server.once("auth-error", (err) => reject(new Error(`Google returned an error: ${err}`)));
  });

  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "Google did not return a refresh token. This usually means the account already granted " +
        "access before. Remove this app's access at https://myaccount.google.com/permissions and try again."
    );
    process.exit(1);
  }
  oauth2Client.setCredentials(tokens);

  const profile = await gmailClient({ version: "v1", auth: oauth2Client }).users.getProfile({ userId: "me" });
  const signedInAs = profile.data.emailAddress;

  if (!signedInAs || signedInAs.toLowerCase() !== expectedSender.toLowerCase()) {
    console.error(
      `\nSigned in as ${signedInAs ?? "(unknown)"}, but GMAIL_SENDER_ADDRESS is set to ${expectedSender}. ` +
        "Nothing was saved. Sign in as the correct account and run this again."
    );
    process.exit(1);
  }

  saveRefreshToken(tokens.refresh_token);
  console.log(`\nConfirmed signed in as ${signedInAs}. GMAIL_REFRESH_TOKEN has been saved to .env.local.`);
}

function saveRefreshToken(refreshToken) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  const line = `GMAIL_REFRESH_TOKEN="${refreshToken}"`;
  const pattern = /^GMAIL_REFRESH_TOKEN=.*$/m;

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");
}

main().catch((err) => {
  console.error("\nAuthorisation failed:", err.message);
  process.exit(1);
});
