import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import Table from "@/models/Table";
import User from "@/models/User";

import "@/models/MenuItem";
import "@/models/ComboOffer";

const BACKUP_WAIT_TIME_MS = 4 * 60 * 1000;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type WaiterActionStatus = "PICKED_UP" | "DELIVERED";

type WorkStatus =
  | "ON_DUTY"
  | "ON_BREAK"
  | "OFF_DUTY"
  | "ON_LEAVE";

type WaiterClaimType =
  | "PRIMARY"
  | "BACKUP"
  | "SHARED";

function getEffectiveWorkStatus(
  value: unknown
): WorkStatus {
  /*
   * Old waiter accounts may not have
   * workStatus saved yet.
   */
  if (
    value === "ON_BREAK" ||
    value === "OFF_DUTY" ||
    value === "ON_LEAVE"
  ) {
    return value;
  }

  return "ON_DUTY";
}

function sanitizeNote(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, 500)
    : "";
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    await connectDB();

    /* ==============================
       Authentication
    ============================== */

    const token =
      request.cookies.get("restaurant_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in.",
        },
        {
          status: 401,
        }
      );
    }

    let authUser: ReturnType<typeof verifyToken>;

    try {
      authUser = verifyToken(token);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid or expired login session.",
        },
        {
          status: 401,
        }
      );
    }

    if (authUser.role !== "WAITER") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only waiter accounts can update waiter orders.",
        },
        {
          status: 403,
        }
      );
    }

    const activeWaiter = await User.findOne({
      _id: authUser.id,
      role: "WAITER",
      status: "ACTIVE",
    })
      .select(
        "_id name email role status workStatus"
      )
      .lean();

    if (!activeWaiter) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your waiter account is inactive or unavailable.",
        },
        {
          status: 403,
        }
      );
    }

    const activeWaiterData = activeWaiter as any;

    const loggedInWaiterId = String(
      activeWaiterData._id
    );

    const loggedInWorkStatus =
      getEffectiveWorkStatus(
        activeWaiterData.workStatus
      );

    /* ==============================
       Request validation
    ============================== */

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body = (await request.json()) as {
      status?: string;
      note?: string;
    };

    const requestedStatus = body.status as
      | WaiterActionStatus
      | undefined;

    if (
      requestedStatus !== "PICKED_UP" &&
      requestedStatus !== "DELIVERED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid action. Waiters can only pick up or deliver orders.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * A waiter must be ON_DUTY to claim
     * a new READY order.
     *
     * A waiter who already claimed an order
     * can still finish delivery if their
     * work status was changed unexpectedly.
     */
    if (
      requestedStatus === "PICKED_UP" &&
      loggedInWorkStatus !== "ON_DUTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `You are currently ${loggedInWorkStatus.replaceAll(
              "_",
              " "
            )}. Return to duty before claiming an order.`,
        },
        {
          status: 403,
        }
      );
    }

    /* ==============================
       Load current order
    ============================== */

    const order = await Order.findById(id)
      .select(
        "_id table orderType status paymentStatus paymentType assignedWaiter readyAt createdAt"
      )
      .lean();

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found.",
        },
        {
          status: 404,
        }
      );
    }

    const orderData = order as any;

    const currentAssignedWaiterId =
      orderData.assignedWaiter
        ? String(orderData.assignedWaiter)
        : null;

    /* ==============================
       Load table and primary waiter
    ============================== */

    let tableData: any = null;
    let primaryWaiter: any = null;

    if (orderData.table) {
      tableData = await Table.findById(
        orderData.table
      )
        .select(
          "_id name status assignedWaiter"
        )
        .lean();

      if (!tableData) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The table connected to this order was not found.",
          },
          {
            status: 404,
          }
        );
      }

      if (tableData.assignedWaiter) {
        primaryWaiter = await User.findOne({
          _id: tableData.assignedWaiter,
          role: "WAITER",
        })
          .select(
            "_id name email role status workStatus"
          )
          .lean();
      }
    }

    const primaryWaiterId =
      tableData?.assignedWaiter
        ? String(tableData.assignedWaiter)
        : null;

    /*
     * Primary waiter is available only when:
     *
     * 1. The user still exists
     * 2. Account status is ACTIVE
     * 3. Work status is ON_DUTY
     *
     * Missing workStatus is treated as ON_DUTY
     * for old waiter accounts.
     */
    const primaryWaiterWorkStatus =
      primaryWaiter
        ? getEffectiveWorkStatus(
            primaryWaiter.workStatus
          )
        : null;

    const primaryWaiterIsAvailable =
      Boolean(primaryWaiter) &&
      primaryWaiter.status === "ACTIVE" &&
      primaryWaiterWorkStatus === "ON_DUTY";

    /* ==============================
       PICKED_UP / Claim order
    ============================== */

    if (requestedStatus === "PICKED_UP") {
      if (orderData.status !== "READY") {
        return NextResponse.json(
          {
            success: false,
            message:
              `Order cannot be picked up because its current status is ${orderData.status}.`,
          },
          {
            status: 400,
          }
        );
      }

      /*
       * The order has already been claimed
       * by another waiter.
       */
      if (
        currentAssignedWaiterId &&
        currentAssignedWaiterId !==
          loggedInWaiterId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This order has already been claimed by another waiter.",
          },
          {
            status: 409,
          }
        );
      }

      let waiterClaimType: WaiterClaimType;

      /*
       * No primary waiter:
       * Shared table or order without a table.
       */
      if (!primaryWaiterId) {
        waiterClaimType = "SHARED";
      } else if (
        primaryWaiterId === loggedInWaiterId
      ) {
        /*
         * Logged-in waiter is the primary waiter.
         */
        waiterClaimType = "PRIMARY";
      } else if (!primaryWaiterIsAvailable) {
        /*
         * Primary waiter is unavailable:
         *
         * ON_BREAK
         * OFF_DUTY
         * ON_LEAVE
         * INACTIVE
         * deleted/missing
         *
         * Backup waiter can claim immediately.
         */
        waiterClaimType = "BACKUP";
      } else {
        /*
         * Primary waiter is active and ON_DUTY.
         * Other waiters must wait four minutes.
         */
        const timerStartValue =
          orderData.readyAt ||
          orderData.createdAt;

        const timerStartTime = new Date(
          timerStartValue
        ).getTime();

        const elapsedTime =
          Date.now() - timerStartTime;

        if (elapsedTime < BACKUP_WAIT_TIME_MS) {
          const remainingMilliseconds =
            BACKUP_WAIT_TIME_MS - elapsedTime;

          const remainingSeconds = Math.max(
            1,
            Math.ceil(
              remainingMilliseconds / 1000
            )
          );

          const remainingMinutes = Math.floor(
            remainingSeconds / 60
          );

          const secondsPart =
            remainingSeconds % 60;

          const remainingText =
            remainingMinutes > 0
              ? `${remainingMinutes} minute(s) and ${secondsPart} second(s)`
              : `${secondsPart} second(s)`;

          return NextResponse.json(
            {
              success: false,
              message:
                `${tableData?.name || "This table"} is assigned to ` +
                `${primaryWaiter?.name || "another waiter"}. ` +
                `The order will become available to backup waiters in approximately ${remainingText}.`,
            },
            {
              status: 403,
            }
          );
        }

        waiterClaimType = "BACKUP";
      }

      const defaultClaimNote =
        waiterClaimType === "PRIMARY"
          ? "Primary waiter claimed and picked up the order."
          : waiterClaimType === "BACKUP"
            ? primaryWaiterIsAvailable
              ? "Backup waiter claimed the order after the four-minute timeout."
              : "Backup waiter claimed the order because the primary waiter was unavailable."
            : "Waiter claimed an order from a shared table.";

      const claimNote =
        sanitizeNote(body.note) ||
        defaultClaimNote;

      /*
       * Atomic claim:
       * only the first waiter succeeds.
       */
      const claimedOrder =
        await Order.findOneAndUpdate(
          {
            _id: id,
            status: "READY",

            $or: [
              {
                assignedWaiter: null,
              },
              {
                assignedWaiter: {
                  $exists: false,
                },
              },
              {
                assignedWaiter:
                  activeWaiterData._id,
              },
            ],
          },
          {
            $set: {
              status: "PICKED_UP",

              assignedWaiter:
                activeWaiterData._id,

              waiterClaimedAt: new Date(),

              waiterClaimType,

              pickedUpAt: new Date(),
            },

            $push: {
              statusHistory: {
                fromStatus: "READY",
                toStatus: "PICKED_UP",

                changedBy:
                  activeWaiterData._id,

                changedByName:
                  activeWaiterData.name,

                changedByRole: "WAITER",

                note: claimNote,

                changedAt: new Date(),
              },
            },
          },
          {
            new: true,
            runValidators: true,
          }
        )
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
          .populate(
            "comboItems.comboOffer"
          );

      if (!claimedOrder) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Another waiter claimed this order first. Please refresh the dashboard.",
          },
          {
            status: 409,
          }
        );
      }

      const tableName =
        tableData?.name ||
        "Takeaway / Online order";

      await createAuditLog({
        action: "WAITER_ORDER_CLAIMED",
        module: "WAITER",

        description:
          `${activeWaiterData.name} claimed Order #${id
            .slice(-6)
            .toUpperCase()} for ${tableName} as ${waiterClaimType}.`,

        performedBy:
          activeWaiterData.email ||
          loggedInWaiterId,

        metadata: {
          orderId: id,
          waiterId: loggedInWaiterId,
          tableId:
            tableData?._id?.toString() ||
            null,
          claimType: waiterClaimType,

          primaryWaiterId:
            primaryWaiterId || null,

          primaryWaiterAvailable:
            primaryWaiterIsAvailable,

          primaryWaiterWorkStatus:
            primaryWaiterWorkStatus,
        },
      });

      return NextResponse.json({
        success: true,

        message:
          waiterClaimType === "BACKUP"
            ? primaryWaiterIsAvailable
              ? "Backup order claimed after the four-minute timeout."
              : "Backup order claimed because the primary waiter is unavailable."
            : waiterClaimType === "PRIMARY"
              ? "Primary order picked up successfully."
              : "Shared order picked up successfully.",

        data: JSON.parse(
          JSON.stringify(claimedOrder)
        ),
      });
    }

    /* ==============================
       DELIVERED
    ============================== */

    if (orderData.status !== "PICKED_UP") {
      return NextResponse.json(
        {
          success: false,

          message:
            `Order cannot be delivered because its current status is ${orderData.status}.`,
        },
        {
          status: 400,
        }
      );
    }

    if (!currentAssignedWaiterId) {
      return NextResponse.json(
        {
          success: false,

          message:
            "This order has no assigned waiter. Pick up the order first.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Only the waiter who claimed the order
     * can complete delivery.
     */
    if (
      currentAssignedWaiterId !==
      loggedInWaiterId
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Only the waiter who claimed this order can mark it as delivered.",
        },
        {
          status: 403,
        }
      );
    }

    const deliveryNote =
      sanitizeNote(body.note) ||
      "Order delivered to the customer.";

    const deliveredOrder =
      await Order.findOneAndUpdate(
        {
          _id: id,
          status: "PICKED_UP",

          assignedWaiter:
            activeWaiterData._id,
        },
        {
          $set: {
            status: "DELIVERED",
            deliveredAt: new Date(),
          },

          $push: {
            statusHistory: {
              fromStatus: "PICKED_UP",
              toStatus: "DELIVERED",

              changedBy:
                activeWaiterData._id,

              changedByName:
                activeWaiterData.name,

              changedByRole: "WAITER",

              note: deliveryNote,

              changedAt: new Date(),
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
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
        .populate(
          "comboItems.comboOffer"
        );

    if (!deliveredOrder) {
      return NextResponse.json(
        {
          success: false,

          message:
            "The order was already updated. Please refresh the dashboard.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Release a dine-in table only when
     * payment has already been completed.
     *
     * PAY_LATER and unpaid tables remain
     * occupied until cashier settlement.
     */
    if (
      orderData.orderType === "DINE_IN" &&
      tableData?._id &&
      orderData.paymentStatus === "PAID"
    ) {
      await Table.findByIdAndUpdate(
        tableData._id,
        {
          $set: {
            status: "AVAILABLE",
          },
        }
      );
    }

    const tableName =
      tableData?.name ||
      "Takeaway / Online order";

    await createAuditLog({
      action: "WAITER_ORDER_DELIVERED",
      module: "WAITER",

      description:
        `${activeWaiterData.name} delivered Order #${id
          .slice(-6)
          .toUpperCase()} for ${tableName}.`,

      performedBy:
        activeWaiterData.email ||
        loggedInWaiterId,

      metadata: {
        orderId: id,
        waiterId: loggedInWaiterId,

        tableId:
          tableData?._id?.toString() ||
          null,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Order delivered successfully.",

      data: JSON.parse(
        JSON.stringify(deliveredOrder)
      ),
    });
  } catch (error) {
    console.error(
      "Waiter order PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to update waiter order.",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}