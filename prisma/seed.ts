import { PrismaClient } from "@prisma/client";
import { runSeeds, verifySeedContent } from "./seeds";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed…");
  const summary = await runSeeds(prisma);
  console.log(
    `Seeded: prayers=${summary.prayers} saints=${summary.saints} apparitions=${summary.apparitions} devotions=${summary.devotions} parishes=${summary.parishes} liturgy=${summary.liturgyEntries} guides=${summary.spiritualLifeGuides}`,
  );
  await verifySeedContent(prisma);
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
