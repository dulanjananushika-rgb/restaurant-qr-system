"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  Loader2,
  RefreshCw,
  UserRoundCheck,
  Users,
} from "lucide-react";

type Waiter = {
  _id: string;
  name: string;
  email: string;
  role: "WAITER";
  status: "ACTIVE" | "INACTIVE";
};

type RestaurantTable = {
  _id: string;
  name: string;
  capacity: number;
  qrCode: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "INACTIVE";
  assignedWaiter: Waiter | null;
};

type GetAssignmentResponse = {
  success: boolean;
  message?: string;
  data?: {
    tables: RestaurantTable[];
    waiters: Waiter[];
  };
};

type PatchAssignmentResponse = {
  success: boolean;
  message?: string;
};

type WaiterAssignmentSummary = {
  waiter: Waiter;
  tables: RestaurantTable[];
};

function sortTables(
  tableList: RestaurantTable[]
): RestaurantTable[] {
  return [...tableList].sort((firstTable, secondTable) => {
    const firstNumber = Number(
      firstTable.name.match(/\d+/)?.[0] ?? Number.NaN
    );

    const secondNumber = Number(
      secondTable.name.match(/\d+/)?.[0] ?? Number.NaN
    );

    if (
      Number.isFinite(firstNumber) &&
      Number.isFinite(secondNumber)
    ) {
      return firstNumber - secondNumber;
    }

    return firstTable.name.localeCompare(secondTable.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export default function TableAssignmentsPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [savingTableId, setSavingTableId] =
    useState<string | null>(null);

  const [fromTableId, setFromTableId] = useState("");
  const [toTableId, setToTableId] = useState("");
  const [bulkWaiterId, setBulkWaiterId] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sortedTables = useMemo(() => {
    return sortTables(tables);
  }, [tables]);

  /*
   * Create a summary showing which tables
   * are assigned to each waiter.
   */
  const waiterAssignmentSummary = useMemo(() => {
    const assignmentMap = new Map<
      string,
      WaiterAssignmentSummary
    >();

    sortedTables.forEach((table) => {
      const assignedWaiter = table.assignedWaiter;

      if (!assignedWaiter) {
        return;
      }

      const existingSummary = assignmentMap.get(
        assignedWaiter._id
      );

      if (existingSummary) {
        existingSummary.tables.push(table);
      } else {
        assignmentMap.set(assignedWaiter._id, {
          waiter: assignedWaiter,
          tables: [table],
        });
      }
    });

    return Array.from(assignmentMap.values()).sort(
      (firstSummary, secondSummary) =>
        firstSummary.waiter.name.localeCompare(
          secondSummary.waiter.name
        )
    );
  }, [sortedTables]);

  /*
   * Tables without an assigned waiter.
   */
  const sharedTables = useMemo(() => {
    return sortedTables.filter(
      (table) => !table.assignedWaiter
    );
  }, [sortedTables]);

  /*
   * Selected range preview.
   */
  const selectedRangeTables = useMemo(() => {
    if (!fromTableId || !toTableId) {
      return [];
    }

    const fromIndex = sortedTables.findIndex(
      (table) => table._id === fromTableId
    );

    const toIndex = sortedTables.findIndex(
      (table) => table._id === toTableId
    );

    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    return sortedTables.slice(startIndex, endIndex + 1);
  }, [fromTableId, toTableId, sortedTables]);

  /*
   * Always reload assignments from the database.
   * This prevents old or missing assignment details.
   */
  const loadAssignments = useCallback(
    async (showFullLoader = false) => {
      try {
        if (showFullLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response = await fetch(
          "/api/admin/table-assignments",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result: GetAssignmentResponse =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ||
              "Failed to load table assignments"
          );
        }

        const orderedTables = sortTables(
          result.data.tables
        );

        setTables(orderedTables);
        setWaiters(result.data.waiters);

        if (orderedTables.length > 0) {
          setFromTableId((currentValue) => {
            const stillExists = orderedTables.some(
              (table) => table._id === currentValue
            );

            return stillExists
              ? currentValue
              : orderedTables[0]._id;
          });

          setToTableId((currentValue) => {
            const stillExists = orderedTables.some(
              (table) => table._id === currentValue
            );

            return stillExists
              ? currentValue
              : orderedTables[0]._id;
          });
        } else {
          setFromTableId("");
          setToTableId("");
        }
      } catch (loadError) {
        console.error(
          "Load table assignments error:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load table assignments"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadAssignments(true);
  }, [loadAssignments]);

  /*
   * Send assignment update to API.
   * Reload all assignments after saving.
   */
  async function updateAssignments(
    tableIds: string[],
    waiterId: string | null
  ) {
    const response = await fetch(
      "/api/admin/table-assignments",
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          tableIds,
          waiterId,
        }),
      }
    );

    const result: PatchAssignmentResponse =
      await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "Failed to update table assignments"
      );
    }

    /*
     * Reload every table from the database.
     * Previous waiter assignments will not disappear.
     */
    await loadAssignments(false);

    return (
      result.message ||
      "Table assignments updated successfully"
    );
  }

  async function assignSingleTable(
    tableId: string,
    waiterId: string
  ) {
    try {
      setSavingTableId(tableId);
      setError("");
      setSuccessMessage("");

      const message = await updateAssignments(
        [tableId],
        waiterId || null
      );

      setSuccessMessage(message);
    } catch (assignmentError) {
      console.error(
        "Single table assignment error:",
        assignmentError
      );

      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Failed to update table assignment"
      );
    } finally {
      setSavingTableId(null);
    }
  }

  async function assignTableRange() {
    try {
      setError("");
      setSuccessMessage("");

      if (!fromTableId || !toTableId) {
        setError(
          "Please select both From Table and To Table."
        );
        return;
      }

      if (selectedRangeTables.length === 0) {
        setError(
          "No tables were found in the selected range."
        );
        return;
      }

      setBulkSaving(true);

      const selectedTableIds =
        selectedRangeTables.map((table) => table._id);

      const message = await updateAssignments(
        selectedTableIds,
        bulkWaiterId || null
      );

      setSuccessMessage(message);
    } catch (assignmentError) {
      console.error(
        "Bulk table assignment error:",
        assignmentError
      );

      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Failed to assign table range"
      );
    } finally {
      setBulkSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-300">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading table assignments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-amber-400">
            Waiter Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Table Waiter Assignments
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Assign tables to waiters and view how many tables
            each waiter is currently responsible for.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAssignments(false)}
          disabled={refreshing || bulkSaving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:border-amber-500 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Assignment summary */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Current Assignment Summary
          </h2>

          <p className="mt-1 text-sm text-neutral-400">
            See each waiter&apos;s assigned tables and total
            table count.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {waiterAssignmentSummary.map((summary) => (
            <div
              key={summary.waiter._id}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <UserRoundCheck className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      {summary.waiter.name}
                    </h3>

                    <p className="mt-1 text-xs text-neutral-400">
                      {summary.waiter.email}
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  {summary.tables.length}{" "}
                  {summary.tables.length === 1
                    ? "Table"
                    : "Tables"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {summary.tables.map((table) => (
                  <span
                    key={table._id}
                    className="rounded-full border border-emerald-500/20 bg-neutral-950 px-3 py-1 text-xs text-neutral-200"
                  >
                    {table.name}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Shared table summary */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-3">
                  <Users className="h-5 w-5 text-amber-400" />
                </div>

                <div>
                  <h3 className="font-semibold text-white">
                    Shared Tables
                  </h3>

                  <p className="mt-1 text-xs text-neutral-400">
                    Available to all waiters
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-300">
                {sharedTables.length}{" "}
                {sharedTables.length === 1
                  ? "Table"
                  : "Tables"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {sharedTables.length > 0 ? (
                sharedTables.map((table) => (
                  <span
                    key={table._id}
                    className="rounded-full border border-amber-500/20 bg-neutral-950 px-3 py-1 text-xs text-neutral-200"
                  >
                    {table.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No shared tables.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bulk assignment */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/10 p-3">
            <Layers3 className="h-6 w-6 text-amber-400" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">
              Assign a Table Range
            </h2>

            <p className="mt-1 text-sm leading-6 text-neutral-400">
              Select the first table, last table and waiter.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr_1.4fr] md:items-end">
          <div>
            <label
              htmlFor="from-table"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              From Table
            </label>

            <select
              id="from-table"
              value={fromTableId}
              disabled={bulkSaving}
              onChange={(event) =>
                setFromTableId(event.target.value)
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
            >
              {sortedTables.map((table) => (
                <option key={table._id} value={table._id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden pb-3 md:block">
            <ArrowRight className="h-5 w-5 text-neutral-500" />
          </div>

          <div>
            <label
              htmlFor="to-table"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              To Table
            </label>

            <select
              id="to-table"
              value={toTableId}
              disabled={bulkSaving}
              onChange={(event) =>
                setToTableId(event.target.value)
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
            >
              {sortedTables.map((table) => (
                <option key={table._id} value={table._id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="bulk-waiter"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              Assign Waiter
            </label>

            <select
              id="bulk-waiter"
              value={bulkWaiterId}
              disabled={bulkSaving}
              onChange={(event) =>
                setBulkWaiterId(event.target.value)
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
            >
              <option value="">Shared — All waiters</option>

              {waiters.map((waiter) => (
                <option key={waiter._id} value={waiter._id}>
                  {waiter.name} — {waiter.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-neutral-400">
            Selected tables
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {selectedRangeTables.map((table) => (
              <span
                key={table._id}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
              >
                {table.name}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Total selected: {selectedRangeTables.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void assignTableRange()}
          disabled={
            bulkSaving ||
            selectedRangeTables.length === 0
          }
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          {bulkSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <UserRoundCheck className="h-4 w-4" />
              Assign Selected Range
            </>
          )}
        </button>
      </section>

      {/* Individual table assignment */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Individual Table Assignments
          </h2>

          <p className="mt-1 text-sm text-neutral-400">
            Change one table assignment separately.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedTables.map((table) => {
            const isSaving =
              savingTableId === table._id;

            return (
              <div
                key={table._id}
                className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {table.name}
                    </h3>

                    <p className="mt-2 text-sm text-neutral-400">
                      Capacity: {table.capacity}
                    </p>
                  </div>

                  <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300">
                    {table.status}
                  </span>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor={`waiter-${table._id}`}
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    Assigned waiter
                  </label>

                  <div className="relative">
                    <select
                      id={`waiter-${table._id}`}
                      value={
                        table.assignedWaiter?._id || ""
                      }
                      disabled={isSaving || bulkSaving}
                      onChange={(event) =>
                        void assignSingleTable(
                          table._id,
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 pr-10 text-sm text-white outline-none focus:border-amber-500"
                    >
                      <option value="">
                        Shared — All waiters
                      </option>

                      {waiters.map((waiter) => (
                        <option
                          key={waiter._id}
                          value={waiter._id}
                        >
                          {waiter.name} — {waiter.email}
                        </option>
                      ))}
                    </select>

                    {isSaving && (
                      <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-amber-400" />
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-900 p-3">
                  {table.assignedWaiter ? (
                    <>
                      <p className="text-sm font-medium text-emerald-300">
                        {table.assignedWaiter.name}
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Primary waiter for {table.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-amber-300">
                        Shared Table
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Available to all waiters
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}