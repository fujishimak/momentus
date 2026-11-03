"use client";

import { useEffect, useRef, useState } from "react";
import { getStore, type ChatMessage } from "@/lib/db";
import { getEmbedder } from "@/lib/ai/embeddings";
import { answerQuestion } from "@/lib/ai/chat";

const INFO_COPY =
  "Momentus answers using only your own entries, processed privately on your " +
  "device. Nothing you record or ask is sent to the cloud.";

/**
 * Chat with AI (design §3.4): a single persistent conversation. User messages
 * and assistant answers are stored in `chat_message` and reloaded on mount, so
 * the thread survives navigation and reloads. Answers are retrieval-grounded
 * and generated on-device (extractive fallback by default).
 */
export function ChatThread() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getStore()
      .listChatMessages()
      .then((msgs) => {
        if (active) setMessages(msgs);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (text === "" || busy) return;
    setBusy(true);
    setDraft("");
    const store = getStore();

    const userMsg = await store.appendChatMessage({
      role: "user",
      content: text,
    });
    setMessages((m) => [...m, userMsg]);

    try {
      const answer = await answerQuestion(
        store,
        { embedder: getEmbedder() },
        text,
      );
      const aiMsg = await store.appendChatMessage({
        role: "assistant",
        content: answer,
      });
      setMessages((m) => [...m, aiMsg]);
    } catch {
      const aiMsg = await store.appendChatMessage({
        role: "assistant",
        content: "Sorry, I couldn't answer that just now.",
      });
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen chat" aria-labelledby="chat-heading">
      <header className="screen__header">
        <h1 id="chat-heading" className="screen__title">
          Chat with AI
        </h1>
        <button
          type="button"
          className="chat__info"
          aria-label="About Chat with AI"
          aria-expanded={showInfo}
          onClick={() => setShowInfo((v) => !v)}
        >
          ⓘ
        </button>
      </header>

      {showInfo && (
        <p className="chat__info-copy" role="note">
          {INFO_COPY}
        </p>
      )}

      <div className="chat__thread">
        {messages.length === 0 ? (
          <p className="screen__placeholder">
            Ask about your past entries — e.g. &ldquo;what did I record a year
            ago?&rdquo;
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`chat__bubble chat__bubble--${m.role}`}
              data-role={m.role}
            >
              {m.content}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat__input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          className="chat__input"
          placeholder="Ask me anything…"
          aria-label="Ask me anything"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="chat__send"
          aria-label="Send"
          disabled={busy}
        >
          ➤
        </button>
      </form>
    </section>
  );
}
