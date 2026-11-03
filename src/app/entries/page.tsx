export default function EntriesPage() {
  return (
    <section className="screen" aria-labelledby="entries-heading">
      <header className="screen__header">
        <h1 id="entries-heading" className="screen__title">
          Your Entries
        </h1>
      </header>
      <p className="screen__placeholder">
        Your recorded moments will appear here.
      </p>
    </section>
  );
}
