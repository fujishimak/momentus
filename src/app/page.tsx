export default function CapturePage() {
  return (
    <section className="capture" aria-labelledby="capture-heading">
      <h1 id="capture-heading" className="capture__heading">
        What&rsquo;s On Your Mind?
      </h1>

      <div className="capture__focal">
        <button
          type="button"
          className="mic-button"
          aria-label="Start recording"
        >
          <span className="mic-button__glyph" aria-hidden="true">
            🎤
          </span>
        </button>
      </div>

      <button
        type="button"
        className="pencil-fab"
        aria-label="Write text instead"
      >
        <span aria-hidden="true">✏️</span>
      </button>
    </section>
  );
}
