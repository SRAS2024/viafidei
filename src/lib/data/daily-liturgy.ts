import { prisma } from "../db/client";

function startOfDay(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function getDailyLiturgyForDate(date: Date) {
  return prisma.dailyLiturgy.findUnique({ where: { date: startOfDay(date) } });
}

export function listDailyLiturgyRange(from: Date, to: Date) {
  return prisma.dailyLiturgy.findMany({
    where: { date: { gte: startOfDay(from), lte: startOfDay(to) }, status: "PUBLISHED" },
    orderBy: { date: "asc" },
  });
}
