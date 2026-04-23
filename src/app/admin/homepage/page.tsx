import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";
import { HomepageMirrorEditor } from "./HomepageMirrorEditor";

export default async function AdminHomepage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  let page = await prisma.homePage.findUnique({
    where: { slug: "homepage" },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page) {
    page = await prisma.homePage.create({
      data: {
        slug: "homepage",
        title: "Via Fidei",
        status: "DRAFT",
        blocks: {
          create: [
            {
              blockKey: "hero",
              blockType: "hero",
              sortOrder: 0,
              configJson: {
                eyebrow: "Est. MMXXVI · Canonical",
                title: "A quiet place to pray, to learn, and to return.",
                lede:
                  "Via Fidei is a multilingual Catholic companion — a curated library of prayers, saints, sacramental guidance, liturgical formation, and parish discovery.",
              },
            },
            {
              blockKey: "mission",
              blockType: "two-column",
              sortOrder: 1,
              configJson: {
                left: { title: "Our mission", body: "We make the beauty and precision of the Catholic tradition legible." },
                right: { title: "What is Catholicism?", body: "The Catholic Church is the community of disciples gathered around Jesus Christ." },
              },
            },
          ],
        },
      },
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return (
    <AdminSection titleKey="admin.card.homepage">
      <HomepageMirrorEditor
        pageId={page.id}
        initialBlocks={page.blocks.map((b) => ({
          id: b.id,
          blockKey: b.blockKey,
          blockType: b.blockType,
          sortOrder: b.sortOrder,
          configJson: b.configJson as Record<string, unknown>,
        }))}
      />
    </AdminSection>
  );
}
