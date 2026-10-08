"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng, ScoredListing } from "@/lib/types";

type Props = {
  anchor: LatLng;
  anchorLabel: string;
  listings: ScoredListing[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

function pinColor(l: ScoredListing) {
  if (l.excluded.length) return "#94a3b8";
  const s = l.scores.total;
  return s >= 80 ? "#10b981" : s >= 65 ? "#84cc16" : s >= 50 ? "#f59e0b" : "#f43f5e";
}

export default function MapView({ anchor, anchorLabel, listings, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView([anchor.lat, anchor.lng], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [anchor.lat, anchor.lng]);

  useEffect(() => {
    const draw = () => {
      const L = leaflet.current;
      if (!L || !layer.current) return;
      layer.current.clearLayers();
      L.marker([anchor.lat, anchor.lng], {
        icon: L.divIcon({ className: "", html: `<div class="partly-pin" style="width:30px;height:30px;background:#4f46e5">★</div>`, iconSize: [30, 30] }),
        zIndexOffset: 1000,
      })
        .bindTooltip(anchorLabel)
        .addTo(layer.current);
      for (const l of listings) {
        const selected = l.id === selectedId;
        const size = selected ? 34 : 26;
        L.marker([l.lat, l.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="partly-pin" style="width:${size}px;height:${size}px;background:${pinColor(l)};${selected ? "outline:3px solid #1e1b4b;" : ""}">${l.scores.total}</div>`,
            iconSize: [size, size],
          }),
          zIndexOffset: selected ? 900 : l.excluded.length ? 0 : 100,
        })
          .bindTooltip(`${l.address} · $${l.rent.toLocaleString()} · ${l.commute.minutes} min`)
          .on("click", () => onSelectRef.current(l.id))
          .addTo(layer.current!);
      }
    };
    if (leaflet.current) draw();
    else {
      const t = setInterval(() => {
        if (leaflet.current && layer.current) {
          clearInterval(t);
          draw();
        }
      }, 50);
      return () => clearInterval(t);
    }
  }, [listings, selectedId, anchor.lat, anchor.lng, anchorLabel]);

  useEffect(() => {
    const target = listings.find((l) => l.id === selectedId);
    if (target && map.current) map.current.panTo([target.lat, target.lng]);
  }, [selectedId, listings]);

  return <div ref={el} className="h-full w-full" />;
}
