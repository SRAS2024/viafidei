"use client";

import { useRef, useState, useTransition } from "react";
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
    /** What the alert says when the milestone could not be removed. */
    removeFailed?: string;
  };
};

export function MilestoneDeleteButton({ milestoneId, milestoneTitle, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleConfirm() {
    setOpen(false);
    setFailed(false);
    startTransition(async () => {
      const res = await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      // This button leaves with its row. Focus moves to the section's heading, so
      // a keyboard or screen-reader user stays where they were working.
      const heading = buttonRef.current?.closest("section")?.querySelector("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="vf-link-danger"
        aria-disabled={pending}
        aria-busy={pending}
        aria-label={`${labels.delete}: ${milestoneTitle}`}
        onClick={() => {
          if (!pending) setOpen(true);
        }}
      >
        {labels.delete}
      </button>
      {failed ? (
        <p role="alert" className="vf-field-error w-full">
          {labels.removeFailed ?? "Could not remove that milestone. Please try again."}
        </p>
      ) : null}
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
