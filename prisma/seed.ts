import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prayers = [
    {
      slug: "pater-noster",
      defaultTitle: "Pater Noster",
      category: "Dominical",
      body:
        "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
    },
    {
      slug: "ave-maria",
      defaultTitle: "Ave Maria",
      category: "Marian",
      body:
        "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
    },
    {
      slug: "anima-christi",
      defaultTitle: "Anima Christi",
      category: "Eucharistic",
      body:
        "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within thy wounds hide me. Suffer me not to be separated from thee. From the malignant enemy defend me. In the hour of my death call me, and bid me come unto thee, that with thy saints I may praise thee for ever and ever. Amen.",
    },
    {
      slug: "regina-caeli",
      defaultTitle: "Regina Cæli",
      category: "Marian",
      body:
        "Queen of Heaven, rejoice, alleluia, for He whom you did merit to bear, alleluia, has risen as He said, alleluia. Pray for us to God, alleluia.",
    },
    {
      slug: "memorare",
      defaultTitle: "Memorare",
      category: "Marian",
      body:
        "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession, was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee I come; before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
    },
  ];

  for (const p of prayers) {
    await prisma.prayer.upsert({
      where: { slug: p.slug },
      update: { status: "PUBLISHED" },
      create: { ...p, status: "PUBLISHED" },
    });
  }

  const saints = [
    {
      slug: "st-augustine-of-hippo",
      canonicalName: "St. Augustine of Hippo",
      feastDay: "August 28",
      patronages: ["Theologians", "Printers", "Brewers"],
      biography:
        "Doctor of the Church, author of the Confessions and The City of God; his vigorous theology shaped the Latin tradition.",
    },
    {
      slug: "st-therese-of-lisieux",
      canonicalName: "St. Thérèse of Lisieux",
      feastDay: "October 1",
      patronages: ["Missions", "Florists"],
      biography:
        "The Little Flower; Doctor of the Church known for her Little Way of spiritual childhood and confidence in God.",
    },
    {
      slug: "st-thomas-aquinas",
      canonicalName: "St. Thomas Aquinas",
      feastDay: "January 28",
      patronages: ["Students", "Schools", "Philosophers"],
      biography:
        "Angelic Doctor; the Summa Theologica remains a monumental synthesis of Christian philosophy and theology.",
    },
    {
      slug: "st-joseph",
      canonicalName: "St. Joseph",
      feastDay: "March 19",
      patronages: ["The Universal Church", "Fathers", "Workers"],
      biography:
        "Foster father of Jesus and husband of the Blessed Virgin Mary; patron of the Universal Church.",
    },
  ];

  for (const s of saints) {
    await prisma.saint.upsert({
      where: { slug: s.slug },
      update: { status: "PUBLISHED" },
      create: { ...s, status: "PUBLISHED" },
    });
  }

  const apparitions = [
    {
      slug: "our-lady-of-guadalupe",
      title: "Our Lady of Guadalupe",
      location: "Tepeyac",
      country: "Mexico",
      approvedStatus: "Approved",
      summary:
        "In December 1531 the Blessed Virgin appeared to St. Juan Diego, leaving her image on the tilma still venerated today in the Basilica of Guadalupe.",
    },
    {
      slug: "our-lady-of-lourdes",
      title: "Our Lady of Lourdes",
      location: "Lourdes",
      country: "France",
      approvedStatus: "Approved",
      summary:
        "In 1858 the Blessed Virgin appeared to St. Bernadette Soubirous at Massabielle, identifying herself as the Immaculate Conception.",
    },
    {
      slug: "our-lady-of-fatima",
      title: "Our Lady of Fátima",
      location: "Fátima",
      country: "Portugal",
      approvedStatus: "Approved",
      summary:
        "In 1917 the Blessed Virgin appeared to three shepherd children, calling the faithful to prayer, penance, and devotion to the Immaculate Heart.",
    },
  ];

  for (const a of apparitions) {
    await prisma.marianApparition.upsert({
      where: { slug: a.slug },
      update: { status: "PUBLISHED" },
      create: { ...a, status: "PUBLISHED" },
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: "favicon" },
    update: {},
    create: {
      key: "favicon",
      valueJson: { url: "/favicon.svg", altText: "Via Fidei emblem" },
    },
  });

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
