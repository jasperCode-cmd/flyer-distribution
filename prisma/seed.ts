import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Placeholder passwords only — both users must change these after first
// login. Never reuse these in a real deployment beyond that first login.
const SEED_USERS = [
  {
    email: "jasper@flyerdistributionhampshire.co.uk",
    username: "jasper",
    name: "Jasper Adams",
    password: "ChangeMe-Jasper-2026!",
  },
  {
    email: "daniel@flyerdistributionhampshire.co.uk",
    username: "dan",
    name: "Daniel Whitby",
    password: "ChangeMe-Daniel-2026!",
  },
];

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      // Only the username is reconciled on an existing row, so re-running
      // the seed keeps login handles consistent without ever resetting a
      // password the real user has since set, or re-raising the
      // mustChangePassword flag.
      update: { username: u.username },
      create: {
        email: u.email,
        username: u.username,
        name: u.name,
        passwordHash,
        role: "admin",
        mustChangePassword: true,
      },
    });
    console.log(`Seeded user: ${u.email} (placeholder password: ${u.password})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
