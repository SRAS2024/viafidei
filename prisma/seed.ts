import { PrismaClient } from "@prisma/client";
import { runSeeds } from "./seeds";

const prisma = new PrismaClient();

async function main() {
  await runSeeds(prisma);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
