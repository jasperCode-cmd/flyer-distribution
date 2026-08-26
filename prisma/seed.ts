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
    name: "Jasper Adams",
    password: "ChangeMe-Jasper-2026!",
  },
  {
    email: "daniel@flyerdistributionhampshire.co.uk",
    name: "Daniel Whitby",
    password: "ChangeMe-Daniel-2026!",
  },
];

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: "admin",
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
