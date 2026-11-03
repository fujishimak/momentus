"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntryDetail } from "@/components/EntryDetail";

function DetailInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  if (!id) {
    return <p className="screen__placeholder">Entry not found.</p>;
  }

  return (
    <section className="screen" aria-labelledby="detail-heading">
      <header className="screen__header screen__header--with-back">
        <button
          type="button"
          className="screen__back"
          aria-label="Back to entries"
          onClick={() => router.push("/entries/")}
        >
          ‹
        </button>
        <h1 id="detail-heading" className="screen__title">
          Entry
        </h1>
      </header>
      <EntryDetail entryId={id} onDeleted={() => router.push("/entries/")} />
    </section>
  );
}

export default function EntryDetailPage() {
  return (
    <Suspense fallback={<p className="screen__placeholder">Loading…</p>}>
      <DetailInner />
    </Suspense>
  );
}
