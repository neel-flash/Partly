"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AgentState } from "./agent";
import { scoreListings } from "./scoring";
import type { Intake, Lead, ScoredListing, SearchResponse } from "./types";

export type AppState = {
  intake: Intake | null;
  search: SearchResponse | null;
  agent: AgentState;
  autoBackfill: boolean;
};

const KEY = "partly:v1";
const EMPTY: AppState = { intake: null, search: null, agent: { clock: 0, leads: {}, log: [] }, autoBackfill: true };

let state: AppState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as AppState) };
  } catch {
    state = EMPTY;
  }
}

export function setState(updater: (s: AppState) => AppState) {
  load();
  state = updater(state);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Could not persist Partly state", err);
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useScored(): ScoredListing[] {
  const { intake, search } = useApp();
  return useMemo(
    () => (intake && search ? scoreListings(search.listings, intake, search.meta.medianRentPerBed) : []),
    [intake, search],
  );
}

export function newLead(listingId: string): Lead {
  return { listingId, stage: "shortlisted", addedAt: Date.now(), messages: [], followUps: 0, notes: "" };
}

export function toggleShortlist(listingId: string) {
  setState((s) => {
    const leads = { ...s.agent.leads };
    if (leads[listingId]) {
      if (leads[listingId].stage === "shortlisted") delete leads[listingId];
    } else {
      leads[listingId] = newLead(listingId);
    }
    return { ...s, agent: { ...s.agent, leads } };
  });
}

export function updateLead(listingId: string, patch: Partial<Lead>) {
  setState((s) => {
    const lead = s.agent.leads[listingId];
    if (!lead) return s;
    return { ...s, agent: { ...s.agent, leads: { ...s.agent.leads, [listingId]: { ...lead, ...patch } } } };
  });
}

export function resetAll() {
  setState(() => EMPTY);
}
