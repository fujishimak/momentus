"use client";

import { useEffect, useMemo, useState } from "react";
import { getStore, type Entry } from "@/lib/db";
import {
  filterEntries,
  type ModalityFilter,
  type RangeFilter,
} from "@/lib/entries/view";
import { getEmbedder } from "@/lib/ai/embeddings";
import { semanticSearch } from "@/lib/ai/search";
import { EntryCard } from "./EntryCard";

const MODALITY_CHIPS: { value: ModalityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "audio", label: "Audio" },
  { value: "text", label: "Text" },
];

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/**
 * Your Entries list (design §3.3): search box, modality + range filters, and a
 * reverse-chronological card list loaded from the local store (FR11). Substring
 * search is the day-one fallback; Phase 7 swaps in semantic search.
 */
export function EntriesList() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [range, setRange] = useState<RangeFilter>("all");

  useEffect(() => {
    let active = true;
    getStore()
      .listEntries()
      .then((list) => {
        if (active) setEntries(list);
      });
    return () => {
      active = false;
    };
  }, []);

  // Semantic search (FR12) on query change, debounced. Falls back to substring
  // internally (R1) when embeddings are unavailable. Empty query → show all.
  useEffect(() => {
    const q = query.trim();
    if (q === "") {
      setSearchResults(null);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      semanticSearch(getStore(), getEmbedder(), q).then((results) => {
        if (active) setSearchResults(results);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const visible = useMemo(() => {
    // When a query is active, rank order comes from semantic search; otherwise
    // use the full list. Modality + date range always apply on top.
    const base = query.trim() !== "" ? (searchResults ?? []) : (entries ?? []);
    return filterEntries(base, { modality, query: "", range });
  }, [entries, searchResults, query, modality, range]);

  return (
    <section className="screen" aria-labelledby="entries-heading">
      <header className="screen__header">
        <h1 id="entries-heading" className="screen__title">
          Your Entries
        </h1>
      </header>

      <input
        type="search"
        className="entries__search"
        placeholder="Search your entries…"
        aria-label="Search your entries"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="entries__filters">
        <div
          className="entries__chips"
          role="group"
          aria-label="Filter by type"
        >
          {MODALITY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className="chip"
              data-active={modality === chip.value}
              aria-pressed={modality === chip.value}
              onClick={() => setModality(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <select
          className="entries__range"
          aria-label="Filter by date range"
          value={range}
          onChange={(e) => setRange(e.target.value as RangeFilter)}
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {entries === null ? (
        <p className="screen__placeholder">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="screen__placeholder">No entries yet. Capture a moment!</p>
      ) : (
        <ul className="entries__list">
          {visible.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
