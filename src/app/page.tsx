"use client";

import { useState } from "react";
import { TextSheet } from "@/components/TextSheet";
import { MicRecorder } from "@/components/MicRecorder";
import { getStore } from "@/lib/db";
import { saveTextEntry, saveAudioEntry } from "@/lib/capture/save-entry";
import { getCurrentLocation } from "@/lib/capture/location";
import { getEmbedder } from "@/lib/ai/embeddings";
import { getSyncController } from "@/lib/sync/controller";
import { SyncStatus } from "@/components/SyncStatus";
import { signOut } from "next-auth/react";

type Mode = "audio" | "text";

export default function CapturePage() {
  const [mode, setMode] = useState<Mode>("audio");

  async function handleSaveText(text: string, photo?: Blob) {
    const loc = await getCurrentLocation();
    await saveTextEntry(getStore(), {
      text,
      photo,
      lat: loc?.lat,
      lng: loc?.lng,
      embedder: getEmbedder(),
    });
    void getSyncController().sync(); // push the new entry (fire-and-forget)
    setMode("audio");
  }

  async function handleSaveAudio(audio: Blob, photo?: Blob) {
    const loc = await getCurrentLocation();
    await saveAudioEntry(getStore(), {
      audio,
      photo,
      lat: loc?.lat,
      lng: loc?.lng,
    });
    void getSyncController().sync(); // push the new entry (fire-and-forget)
  }

  return (
    <section className="capture" aria-labelledby="capture-heading">
      <div className="capture__topbar">
        <SyncStatus />
        <button
          type="button"
          className="capture__signout"
          aria-label="Sign out"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </button>
      </div>
      <h1 id="capture-heading" className="capture__heading">
        What&rsquo;s On Your Mind?
      </h1>

      {mode === "audio" ? (
        <>
          <MicRecorder onSave={handleSaveAudio} />

          <button
            type="button"
            className="pencil-fab"
            aria-label="Write text instead"
            onClick={() => setMode("text")}
          >
            <span aria-hidden="true">✏️</span>
          </button>
        </>
      ) : (
        <>
          <TextSheet onSave={handleSaveText} onClose={() => setMode("audio")} />
          <button
            type="button"
            className="mic-fab"
            aria-label="Record audio instead"
            onClick={() => setMode("audio")}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        </>
      )}
    </section>
  );
}
