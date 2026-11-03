"use client";

import { useState } from "react";
import { TextSheet } from "@/components/TextSheet";
import { MicRecorder } from "@/components/MicRecorder";
import { getStore } from "@/lib/db";
import { saveTextEntry, saveAudioEntry } from "@/lib/capture/save-entry";

type Mode = "audio" | "text";

export default function CapturePage() {
  const [mode, setMode] = useState<Mode>("audio");

  async function handleSaveText(text: string) {
    await saveTextEntry(getStore(), { text });
    setMode("audio");
  }

  async function handleSaveAudio(audio: Blob) {
    await saveAudioEntry(getStore(), { audio });
  }

  return (
    <section className="capture" aria-labelledby="capture-heading">
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
