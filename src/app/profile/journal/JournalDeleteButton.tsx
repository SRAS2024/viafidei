"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  entryId: string;
  entryTitle: string;
  labels: {
    delete: string;
    cancel: string;
    confirmTitle: string;
    confirmBody: string;
  };
};

export function JournalDeleteButton({ entryId, entryTitle, labels }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="vf-link-danger"
        onClick={() => setOpen(true)}
      >
        {labels.delete}
      </button>
      <form
        ref={formRef}
        method="post"
        action={`/api/journal/${entryId}/delete`}
        className="hidden"
      />
      <ConfirmDialog
        open={open}
        title={labels.confirmTitle}
        body={labels.confirmBody}
        entityName={entryTitle}
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.submit();
        }}
      />
    </>
  );
}
