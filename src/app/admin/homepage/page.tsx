import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getOrCreateHomepage } from "@/lib/data/homepage";
import { AdminSection } from "../_sections/AdminSection";
import { HomepageMirrorEditor } from "./HomepageMirrorEditor";

export default async function AdminHomepage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const page = await getOrCreateHomepage();

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
