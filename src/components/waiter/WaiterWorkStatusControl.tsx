"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Clock3,
  Coffee,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

type WorkStatus =
  | "ON_DUTY"
  | "ON_BREAK"
  | "OFF_DUTY"
  | "ON_LEAVE";

type WaiterDetails = {
  _id: string;
  name: string;
  email: string;
  workStatus: WorkStatus;
  workStatusUpdatedAt: string | null;
  shiftStartedAt: string | null;
  shiftEndedAt: string | null;
};

type WorkStatusResponse = {
  success: boolean;
  message?: string;

  data?: {
    waiter: WaiterDetails;
    activeOrderCount: number;
  };
};

type UpdateStatusResponse = {
  success: boolean;
  message?: string;

  data?: {
    workStatus: WorkStatus;
    workStatusUpdatedAt: string | null;
    shiftStartedAt: string | null;
    shiftEndedAt: string | null;
  };
};

const statusInformation: Record<
  WorkStatus,
  {
    label: string;
    description: string;
    badgeClassName: string;
  }
> = {
  ON_DUTY: {
    label: "On Duty",
    description:
      "You can receive and claim new restaurant orders.",
    badgeClassName:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },

  ON_BREAK: {
    label: "On Break",
    description:
      "Your assigned table orders will go to available backup waiters.",
    badgeClassName:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },

  OFF_DUTY: {
    label: "Off Duty",
    description:
      "Your shift has ended. You cannot receive new orders.",
    badgeClassName:
      "border-neutral-600 bg-neutral-800 text-neutral-300",
  },

  ON_LEAVE: {
    label: "On Leave",
    description:
      "Your leave status is controlled by the administrator.",
    badgeClassName:
      "border-red-500/30 bg-red-500/10 text-red-300",
  },
};

export default function WaiterWorkStatusControl() {
  const router = useRouter();

  const [waiter, setWaiter] =
    useState<WaiterDetails | null>(null);

  const [activeOrderCount, setActiveOrderCount] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] =
    useState<WorkStatus | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadWorkStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/waiter/work-status",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result: WorkStatusResponse =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ||
            "Failed to load waiter work status."
        );
      }

      setWaiter(result.data.waiter);
      setActiveOrderCount(
        result.data.activeOrderCount
      );
    } catch (loadError) {
      console.error(
        "Load waiter work status error:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load waiter work status."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkStatus();
  }, [loadWorkStatus]);

  async function updateWorkStatus(
    nextStatus: WorkStatus
  ) {
    try {
      setUpdatingStatus(nextStatus);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        "/api/waiter/work-status",
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            workStatus: nextStatus,
          }),
        }
      );

      const result: UpdateStatusResponse =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ||
            "Failed to update waiter work status."
        );
      }

      setWaiter((currentWaiter) => {
        if (!currentWaiter || !result.data) {
          return currentWaiter;
        }

        return {
          ...currentWaiter,
          workStatus: result.data.workStatus,
          workStatusUpdatedAt:
            result.data.workStatusUpdatedAt,
          shiftStartedAt:
            result.data.shiftStartedAt,
          shiftEndedAt:
            result.data.shiftEndedAt,
        };
      });

      setSuccessMessage(
        result.message ||
          "Work status updated successfully."
      );

      /*
       * Reload the server component so waiter
       * order visibility can be recalculated.
       */
      router.refresh();

      await loadWorkStatus();
    } catch (updateError) {
      console.error(
        "Update waiter work status error:",
        updateError
      );

      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update waiter work status."
      );
    } finally {
      setUpdatingStatus(null);
    }
  }

  function formatDateTime(value: string | null) {
    if (!value) {
      return "Not available";
    }

    return new Intl.DateTimeFormat("en-LK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-neutral-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">
            Loading work status...
          </span>
        </div>
      </section>
    );
  }

  if (!waiter) {
    return (
      <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-5">
        <div className="flex items-center gap-3 text-red-300">
          <TriangleAlert className="h-5 w-5" />

          <span className="text-sm">
            Waiter status could not be loaded.
          </span>
        </div>

        <button
          type="button"
          onClick={() => void loadWorkStatus()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-200"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </section>
    );
  }

  const currentStatus =
    statusInformation[waiter.workStatus];

  const isUpdating = updatingStatus !== null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/[0.05] p-3">
            <BriefcaseBusiness className="h-6 w-6 text-white" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-white">
                Work Status
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${currentStatus.badgeClassName}`}
              >
                {currentStatus.label}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {currentStatus.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-500">
              <span>
                Active orders:{" "}
                <strong className="text-neutral-200">
                  {activeOrderCount}
                </strong>
              </span>

              <span>
                Status changed:{" "}
                <strong className="text-neutral-200">
                  {formatDateTime(
                    waiter.workStatusUpdatedAt
                  )}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {waiter.workStatus === "OFF_DUTY" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateWorkStatus("ON_DUTY")
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingStatus === "ON_DUTY" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              Start Shift
            </button>
          )}

          {waiter.workStatus === "ON_BREAK" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateWorkStatus("ON_DUTY")
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingStatus === "ON_DUTY" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              Return to Duty
            </button>
          )}

          {waiter.workStatus === "ON_DUTY" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateWorkStatus("ON_BREAK")
              }
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingStatus === "ON_BREAK" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coffee className="h-4 w-4" />
              )}

              Take Break
            </button>
          )}

          {(waiter.workStatus === "ON_DUTY" ||
            waiter.workStatus === "ON_BREAK") && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateWorkStatus("OFF_DUTY")
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingStatus === "OFF_DUTY" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}

              End Shift
            </button>
          )}
        </div>
      </div>

      {waiter.workStatus === "ON_LEAVE" && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />

          <div>
            <p className="text-sm font-medium text-red-200">
              You are currently marked as On Leave.
            </p>

            <p className="mt-1 text-xs leading-5 text-red-300/70">
              An administrator must change your leave
              status before you can start a shift.
            </p>
          </div>
        </div>
      )}

      {waiter.workStatus === "OFF_DUTY" && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-neutral-300" />

          <p className="text-sm leading-6 text-neutral-400">
            Start your shift before receiving or claiming
            new orders.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}
    </section>
  );
}