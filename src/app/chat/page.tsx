export default function ChatPage() {
  return (
    <section className="screen" aria-labelledby="chat-heading">
      <header className="screen__header">
        <h1 id="chat-heading" className="screen__title">
          Chat with AI
        </h1>
      </header>
      <p className="screen__placeholder">
        Ask about your past entries. Answers are generated privately on your
        device.
      </p>
    </section>
  );
}
