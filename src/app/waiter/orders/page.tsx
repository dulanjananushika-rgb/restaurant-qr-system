import {
  CheckCircle2,
  Clock,
  HandPlatter,
  Truck,
} from "lucide-react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { connectDB } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import Table from "@/models/Table";
import User from "@/models/User";

import "@/models/MenuItem";
import "@/models/ComboOffer";

import LogoutButton from "@/components/auth/LogoutButton";
import WaiterOrderManager from "@/components/waiter/WaiterOrderManager";
import WaiterWorkStatusControl from "@/components/waiter/WaiterWorkStatusControl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKUP_WAIT_TIME_MINUTES = 4;

type WorkStatus =
  | "ON_DUTY"
  | "ON_BREAK"
  | "OFF_DUTY"
  | "ON_LEAVE";

type PageData = {
  orders: any[];
  viewerRole: "ADMIN" | "WAITER";
  workStatus: WorkStatus | null;
};

/*
 * Add all required populate operations
 * to a waiter order query.
 */
function populateWaiterOrderQuery(query: any) {
  return query
    .populate({
      path: "table",
      populate: {
        path: "assignedWaiter",
        select:
          "name email role status workStatus",
      },
    })
    .populate(
      "assignedWaiter",
      "name email role status workStatus"
    )
    .populate("assignedChef")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer");
}

async function getWaiterPageData(): Promise<PageData> {
  await connectDB();

  /* =========================
     Authentication
  ========================= */

  const cookieStore = await cookies();

  const token =
    cookieStore.get("restaurant_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let authUser: ReturnType<typeof verifyToken>;

  try {
    authUser = verifyToken(token);
  } catch {
    redirect("/login");
  }

  if (
    authUser.role !== "WAITER" &&
    authUser.role !== "ADMIN"
  ) {
    redirect("/login");
  }

  /*
   * Check whether the account still exists
   * and is active.
   */
  const activeUser = await User.findOne({
    _id: authUser.id,
    role: authUser.role,
    status: "ACTIVE",
  })
    .select(
      "_id name email role status workStatus"
    )
    .lean();

  if (!activeUser) {
    redirect("/login");
  }

  const activeUserData = activeUser as any;

  /* =========================
     Admin view
  ========================= */

  if (authUser.role === "ADMIN") {
    const adminQuery = Order.find({
      status: {
        $in: [
          "READY",
          "PICKED_UP",
          "DELIVERED",
        ],
      },
    }).sort({
      createdAt: -1,
    });

    const adminOrders =
      await populateWaiterOrderQuery(
        adminQuery
      ).lean();

    return {
      orders: JSON.parse(
        JSON.stringify(adminOrders)
      ),
      viewerRole: "ADMIN",
      workStatus: null,
    };
  }

  /* =========================
     Waiter work status
  ========================= */

  /*
   * Old waiter accounts may not yet have
   * workStatus saved in MongoDB.
   * Treat them as ON_DUTY.
   */
  const currentWorkStatus: WorkStatus =
    (activeUserData.workStatus as
      | WorkStatus
      | undefined) ?? "ON_DUTY";

  /*
   * A waiter who is not ON_DUTY must not
   * receive new READY orders.
   *
   * They can still see orders that were
   * already claimed by them.
   */
  if (currentWorkStatus !== "ON_DUTY") {
    const existingOrderQuery = Order.find({
      assignedWaiter: authUser.id,

      status: {
        $in: [
          "READY",
          "PICKED_UP",
          "DELIVERED",
        ],
      },
    }).sort({
      createdAt: -1,
    });

    const existingOrders =
      await populateWaiterOrderQuery(
        existingOrderQuery
      ).lean();

    return {
      orders: JSON.parse(
        JSON.stringify(existingOrders)
      ),
      viewerRole: "WAITER",
      workStatus: currentWorkStatus,
    };
  }

  /* =========================
     ON_DUTY waiter visibility
  ========================= */

  /*
   * Load every active ON_DUTY waiter.
   *
   * Existing waiter documents without a
   * workStatus field are also treated as
   * ON_DUTY.
   */
  const onDutyWaiters = await User.find({
    role: "WAITER",
    status: "ACTIVE",

    $or: [
      {
        workStatus: "ON_DUTY",
      },
      {
        workStatus: {
          $exists: false,
        },
      },
      {
        workStatus: null,
      },
    ],
  })
    .select("_id")
    .lean();

  const onDutyWaiterIds = onDutyWaiters.map(
    (waiter: any) => String(waiter._id)
  );

  /*
   * Tables assigned to the logged-in waiter.
   */
  const primaryTables = await Table.find({
    assignedWaiter: authUser.id,
  })
    .select("_id")
    .lean();

  const primaryTableIds = primaryTables.map(
    (table: any) => String(table._id)
  );

  /*
   * Shared tables do not have a primary waiter.
   * All ON_DUTY waiters can see these orders
   * immediately.
   */
  const sharedTables = await Table.find({
    $or: [
      {
        assignedWaiter: null,
      },
      {
        assignedWaiter: {
          $exists: false,
        },
      },
    ],
  })
    .select("_id")
    .lean();

  const sharedTableIds = sharedTables.map(
    (table: any) => String(table._id)
  );

  /*
   * Find tables whose primary waiter is:
   *
   * - ON_BREAK
   * - OFF_DUTY
   * - ON_LEAVE
   * - INACTIVE
   * - deleted/unavailable
   *
   * Orders from these tables become backup
   * orders immediately without waiting
   * four minutes.
   */
  const unavailablePrimaryTables =
    await Table.find({
      assignedWaiter: {
        $exists: true,
        $ne: null,
        $nin: onDutyWaiterIds,
      },
    })
      .select("_id")
      .lean();

  const unavailablePrimaryTableIds =
    unavailablePrimaryTables.map(
      (table: any) => String(table._id)
    );

  /*
   * Four-minute backup cutoff.
   */
  const backupCutoffTime = new Date(
    Date.now() -
      BACKUP_WAIT_TIME_MINUTES *
        60 *
        1000
  );

  /*
   * Waiter can see:
   *
   * 1. Orders already claimed by them.
   * 2. READY orders from their primary tables.
   * 3. READY orders from shared tables.
   * 4. READY orders whose primary waiter is unavailable.
   * 5. Unclaimed READY orders older than four minutes.
   * 6. READY takeaway/online orders without a table.
   */
  const waiterOrderQuery = Order.find({
    $or: [
      /*
       * Orders already claimed by this waiter.
       */
      {
        assignedWaiter: authUser.id,

        status: {
          $in: [
            "READY",
            "PICKED_UP",
            "DELIVERED",
          ],
        },
      },

      /*
       * Unclaimed READY orders from this
       * waiter's primary tables.
       */
      {
        status: "READY",
        assignedWaiter: null,

        table: {
          $in: primaryTableIds,
        },
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        table: {
          $in: primaryTableIds,
        },
      },

      /*
       * Unclaimed READY orders from
       * shared tables.
       */
      {
        status: "READY",
        assignedWaiter: null,

        table: {
          $in: sharedTableIds,
        },
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        table: {
          $in: sharedTableIds,
        },
      },

      /*
       * Primary waiter is unavailable.
       * Show immediately to all ON_DUTY waiters.
       */
      {
        status: "READY",
        assignedWaiter: null,

        table: {
          $in: unavailablePrimaryTableIds,
        },
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        table: {
          $in: unavailablePrimaryTableIds,
        },
      },

      /*
       * Active primary waiter did not claim
       * within four minutes.
       */
      {
        status: "READY",
        assignedWaiter: null,

        readyAt: {
          $lte: backupCutoffTime,
        },
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        readyAt: {
          $lte: backupCutoffTime,
        },
      },

      /*
       * Legacy orders where readyAt is null.
       * Use createdAt as the timer fallback.
       */
      {
        status: "READY",
        assignedWaiter: null,
        readyAt: null,

        createdAt: {
          $lte: backupCutoffTime,
        },
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        readyAt: {
          $exists: false,
        },

        createdAt: {
          $lte: backupCutoffTime,
        },
      },

      /*
       * Takeaway or online orders without
       * a restaurant table.
       */
      {
        status: "READY",
        assignedWaiter: null,
        table: null,
      },

      {
        status: "READY",

        assignedWaiter: {
          $exists: false,
        },

        table: {
          $exists: false,
        },
      },
    ],
  }).sort({
    createdAt: -1,
  });

  const waiterOrders =
    await populateWaiterOrderQuery(
      waiterOrderQuery
    ).lean();

  return {
    orders: JSON.parse(
      JSON.stringify(waiterOrders)
    ),
    viewerRole: "WAITER",
    workStatus: currentWorkStatus,
  };
}

export default async function WaiterOrdersPage() {
  const {
    orders,
    viewerRole,
    workStatus,
  } = await getWaiterPageData();

  const readyOrders = orders.filter(
    (order: { status: string }) =>
      order.status === "READY"
  ).length;

  const pickedUpOrders = orders.filter(
    (order: { status: string }) =>
      order.status === "PICKED_UP"
  ).length;

  const deliveredOrders = orders.filter(
    (order: { status: string }) =>
      order.status === "DELIVERED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Waiter Workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Pickup and deliver table orders
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Primary waiters receive their table orders
            first. An unclaimed order becomes available
            to backup waiters after four minutes. Orders
            from unavailable waiters are released
            immediately.
          </p>
        </div>

        <LogoutButton />
      </div>

      {/* Waiter work status control */}
      {viewerRole === "WAITER" && (
        <WaiterWorkStatusControl />
      )}

      {/* Work status notice */}
      {viewerRole === "WAITER" &&
        workStatus !== "ON_DUTY" && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4 text-sm text-amber-200">
            Your current work status is{" "}
            <strong>
              {workStatus?.replaceAll("_", " ")}
            </strong>
            . Start or return to duty before
            receiving new orders.
          </div>
        )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Service Orders
            </p>

            <HandPlatter className="h-5 w-5 text-white" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {orders.length}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-200">
              Ready
            </p>

            <Clock className="h-5 w-5 text-amber-300" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {readyOrders}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-sky-200">
              Picked Up
            </p>

            <Truck className="h-5 w-5 text-sky-300" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {pickedUpOrders}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-200">
              Delivered
            </p>

            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {deliveredOrders}
          </p>
        </div>
      </div>

      {/* Orders */}
      <WaiterOrderManager orders={orders} />
    </div>
  );
}