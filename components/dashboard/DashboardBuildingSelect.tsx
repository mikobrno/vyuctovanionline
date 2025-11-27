"use client";

import { useMemo, useState } from "react";

export type BuildingOption = {
  id: string;
  name: string;
};

interface DashboardBuildingSelectProps {
  buildings: BuildingOption[];
  initialBuildingId?: string;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function DashboardBuildingSelect({
  buildings,
  initialBuildingId,
}: DashboardBuildingSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(initialBuildingId ?? "");

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return buildings;
    }
    const normalizedQuery = normalize(searchTerm);
    return buildings.filter((building) =>
      normalize(building.name).includes(normalizedQuery)
    );
  }, [buildings, searchTerm]);

  const optionsWithSelection = useMemo(() => {
    if (!selectedId) return filteredOptions;
    const alreadyPresent = filteredOptions.some(
      (building) => building.id === selectedId
    );
    if (alreadyPresent) return filteredOptions;
    const selectedBuilding = buildings.find((b) => b.id === selectedId);
    return selectedBuilding ? [selectedBuilding, ...filteredOptions] : filteredOptions;
  }, [buildings, filteredOptions, selectedId]);

  const showNoResults = searchTerm.trim().length > 0 && filteredOptions.length === 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label
          htmlFor="dashboard-building-search"
          className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
        >
          Hledat dům
        </label>
        <input
          id="dashboard-building-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Začněte psát název domu..."
          className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          autoComplete="off"
        />
      </div>

      <div className="flex-1 min-w-[220px]">
        <label
          htmlFor="dashboard-building-select"
          className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
        >
          Vyberte dům
        </label>
        <select
          id="dashboard-building-select"
          name="buildingId"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-teal-500"
          aria-label="Vybrat dům pro rychlý import"
        >
          <option value="">— Bez filtru —</option>
          {optionsWithSelection.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
        {showNoResults && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Žádný dům neodpovídá hledanému výrazu.
          </p>
        )}
      </div>
    </div>
  );
}
