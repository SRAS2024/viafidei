"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";

type Kind = "prayers" | "saints" | "apparitions" | "devotions" | "parishes";

type Props = {
  kind: Kind;
  entityId: string;
  entityTitle: string;
  labels: {
    remove: string;
    cancel: string;
    removeTitle: string;
    removeBody: string;
  };
};

export function RemoveSavedButton({ kind, entityId, entityTitle, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await fetch(`/api/saved/${kind}?id=${encodeURIComponent(entityId)}`, { method: "DELETE" });
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
        {labels.remove}
      </button>
      <ConfirmDialog
        open={open}
        title={labels.removeTitle}
        body={labels.removeBody}
        entityName={entityTitle}
        cancelLabel={labels.cancel}
        confirmLabel={labels.remove}
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
