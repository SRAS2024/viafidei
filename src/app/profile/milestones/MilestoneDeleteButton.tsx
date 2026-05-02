"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = {
  milestoneId: string;
  milestoneTitle: string;
  labels: {
    delete: string;
    cancel: string;
    deleteTitle: string;
    deleteBody: string;
  };
};

export function MilestoneDeleteButton({ milestoneId, milestoneTitle, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="text-xs text-ink-faint hover:text-liturgical-red"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {labels.delete}
      </button>
      <ConfirmDialog
        open={open}
        title={labels.deleteTitle}
        body={labels.deleteBody}
        entityName={milestoneTitle}
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
