import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import User from "@/models/User";

import "@/models/MenuItem";
import "@/models/ComboOffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CounterPaymentMethod = "CASH" | "CARD";

type CollectRequestBody = {
  paymentMethod?: CounterPaymentMethod;
  note?: string;
};

function sanitizeNote(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 300);
}

async function getAuthenticatedCashier(request: NextRequest) {
  const token =
    request.cookies.get("restaurant_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const authUser = verifyToken(token);

    if (
      authUser.role !== "CASHIER" &&
      authUser.role !== "ADMIN"
    ) {
      return null;
    }

    const activeUser = await User.findOne({
      _id: authUser.id,
      role: authUser.role,
      status: "ACTIVE",
    })
      .select("_id name email role status")
      .lean();

    if (!activeUser) {
      return null;
    }

    return {
      authUser,
      activeUser,
    };
  } catch {
    return null;
  }
}

/*
 * PATCH
 *
 * Complete a READY takeaway order.
 *
 * Already-paid order:
 * READY -> PICKED_UP
 *
 * Unpaid order:
 * Record exact full payment
 * READY -> PICKED_UP
 * paymentStatus -> PAID
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    await connectDB();

    /* =========================
       Authentication
    ========================= */

    const authenticatedUser =
      await getAuthenticatedCashier(request);

    if (!authenticatedUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized. Cashier access is required.",
        },
        {
          status: 401,
        }
      );
    }

    const { authUser, activeUser } =
      authenticatedUser;

    /* =========================
       Validate order ID
    ========================= */

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid takeaway order ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      (await request.json()) as CollectRequestBody;

    const paymentMethod = body.paymentMethod;
    const note = sanitizeNote(body.note);

    /* =========================
       Load takeaway order
    ========================= */

    const order = await Order.findById(id)
      .populate("items.menuItem")
      .populate("comboItems.comboOffer");

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Takeaway order not found.",
        },
        {
          status: 404,
        }
      );
    }

    const orderDoc = order as any;

    if (orderDoc.orderType !== "TAKE_AWAY") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This action is only available for takeaway orders.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * PICKED_UP means the takeaway order
     * has already been collected.
     */
    if (orderDoc.status === "PICKED_UP") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This takeaway order has already been collected.",
        },
        {
          status: 409,
        }
      );
    }

    if (orderDoc.status !== "READY") {
      return NextResponse.json(
        {
          success: false,
          message:
            `The order cannot be collected because its current status is ${orderDoc.status}.`,
        },
        {
          status: 400,
        }
      );
    }

    const totalAmount = Number(
      orderDoc.totalAmount || 0
    );

    if (totalAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The takeaway order total is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const wasAlreadyPaid =
      orderDoc.paymentStatus === "PAID";

    /*
     * An unpaid counter order must be settled
     * by CASH or CARD before collection.
     */
    if (
      !wasAlreadyPaid &&
      paymentMethod !== "CASH" &&
      paymentMethod !== "CARD"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Select CASH or CARD before collecting an unpaid order.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent a duplicate successful payment.
     */
    const existingPaidPayment =
      await Payment.findOne({
        order: orderDoc._id,
        status: "PAID",
      })
        .sort({
          paidAt: -1,
          createdAt: -1,
        })
        .lean();

    const paymentAlreadyRecorded =
      Boolean(existingPaidPayment);

    const previousPaymentStatus =
      orderDoc.paymentStatus;

    const collectedAt = new Date();

    const historyNote = wasAlreadyPaid
      ? note ||
        "Prepared takeaway order handed over to the customer."
      : note ||
        `Full payment received by ${paymentMethod} and order handed over to the customer.`;

    /*
     * Atomic collection update.
     *
     * If two cashier requests happen together,
     * only the first READY order update succeeds.
     */
    const collectedOrder =
      await Order.findOneAndUpdate(
        {
          _id: orderDoc._id,
          orderType: "TAKE_AWAY",
          status: "READY",
        },
        {
          $set: {
            status: "PICKED_UP",
            pickedUpAt: collectedAt,

            ...(wasAlreadyPaid ||
            paymentAlreadyRecorded
              ? {
                  paymentStatus: "PAID",
                }
              : {
                  paymentStatus: "PAID",
                  paymentType:
                    orderDoc.paymentType ||
                    "PAY_LATER",
                }),
          },

          $push: {
            statusHistory: {
              fromStatus: "READY",
              toStatus: "PICKED_UP",

              changedBy: authUser.id,
              changedByName: authUser.name,
              changedByRole: authUser.role,

              note: historyNote,
              changedAt: collectedAt,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("items.menuItem")
        .populate("comboItems.comboOffer");

    if (!collectedOrder) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This takeaway order was already updated. Please refresh the page.",
        },
        {
          status: 409,
        }
      );
    }

    let paymentId:
      | string
      | null = existingPaidPayment
      ? String(existingPaidPayment._id)
      : null;

    /*
     * Create payment only when:
     *
     * - order was not already PAID
     * - another paid Payment record does not exist
     */
    if (
      !wasAlreadyPaid &&
      !paymentAlreadyRecorded
    ) {
      try {
        const payment =
          await Payment.create({
            order: orderDoc._id,
            amount: totalAmount,
            method: paymentMethod,
            status: "PAID",
            paidAt: collectedAt,

            note:
              note ||
              "Takeaway payment received at customer pickup.",
          });

        paymentId =
          payment._id.toString();
      } catch (paymentError) {
        /*
         * Restore the order if payment creation
         * fails after the atomic collection update.
         */
        await Order.findOneAndUpdate(
          {
            _id: orderDoc._id,
            status: "PICKED_UP",
            pickedUpAt: collectedAt,
          },
          {
            $set: {
              status: "READY",
              paymentStatus:
                previousPaymentStatus,
            },

            $unset: {
              pickedUpAt: "",
            },

            $pull: {
              statusHistory: {
                changedAt: collectedAt,
                toStatus: "PICKED_UP",
              },
            },
          }
        );

        throw paymentError;
      }
    }

    const pickupNumber =
      orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase();

    await createAuditLog({
      action:
        "TAKEAWAY_ORDER_COLLECTED",

      module: "CASHIER",

      description:
        `${authUser.name} completed Takeaway Order #${pickupNumber} ` +
        `for ${orderDoc.customerName || "Customer"}. ` +
        `Total: Rs. ${totalAmount}.`,

      performedBy:
        activeUser.email ||
        activeUser.name,

      metadata: {
        orderId:
          orderDoc._id.toString(),

        pickupNumber,

        customerName:
          orderDoc.customerName || "",

        customerPhone:
          orderDoc.customerPhone || "",

        totalAmount,

        paymentPreviouslyCompleted:
          wasAlreadyPaid ||
          paymentAlreadyRecorded,

        paymentMethod:
          wasAlreadyPaid ||
          paymentAlreadyRecorded
            ? existingPaidPayment?.method ||
              null
            : paymentMethod,

        paymentId,
      },
    });

    return NextResponse.json({
      success: true,

      message:
        wasAlreadyPaid ||
        paymentAlreadyRecorded
          ? "Takeaway order handed over successfully."
          : "Payment completed and takeaway order handed over successfully.",

      data: {
        orderId:
          collectedOrder._id.toString(),

        pickupNumber,

        orderStatus: "PICKED_UP",
        displayStatus: "COLLECTED",

        paymentStatus: "PAID",

        paymentMethod:
          wasAlreadyPaid ||
          paymentAlreadyRecorded
            ? existingPaidPayment?.method ||
              null
            : paymentMethod,

        totalAmount,

        collectedAt,

        paymentId,

        receiptUrl:
          `/cashier/receipt/${collectedOrder._id.toString()}`,
      },
    });
  } catch (error) {
    console.error(
      "Takeaway collection PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to complete takeaway order.",

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