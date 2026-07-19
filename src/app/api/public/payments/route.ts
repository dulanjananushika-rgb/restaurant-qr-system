import mongoose from "mongoose";

import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import Payment from "@/models/Payment";

import "@/models/Table";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PaymentRequestBody = {
  orderId?: string;
  method?: "ONLINE";
  note?: string;
};

function sanitizeNote(value: unknown) {
  if (typeof value !== "string") {
    return "Mock online payment";
  }

  return (
    value.trim().slice(0, 500) ||
    "Mock online payment"
  );
}

export async function POST(
  request: NextRequest
) {
  let lockedOrderId:
    | mongoose.Types.ObjectId
    | null = null;

  let previousPaymentStatus = "PENDING";

  try {
    await connectDB();

    const body =
      (await request.json()) as PaymentRequestBody;

    const orderId =
      typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    const note = sanitizeNote(body.note);

    if (
      !orderId ||
      !mongoose.Types.ObjectId.isValid(
        orderId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A valid order ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const order =
      await Order.findById(orderId)
        .populate("table");

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

    const orderDoc = order as any;

    if (
      orderDoc.status === "CANCELLED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A cancelled order cannot be paid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      orderDoc.paymentType !== "PAY_NOW"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This order was created as Pay Later. Please pay through the cashier.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Idempotent response:
     * If the payment already exists, return
     * the existing successful result instead
     * of creating another payment.
     */
    const existingPayment =
      await Payment.findOne({
        order: orderDoc._id,
        status: "PAID",
      })
        .sort({
          paidAt: -1,
          createdAt: -1,
        })
        .lean();

    if (
      orderDoc.paymentStatus === "PAID" &&
      existingPayment
    ) {
      return NextResponse.json(
        {
          success: true,
          message:
            "This order is already paid.",

          data: {
            paymentId:
              (
                existingPayment as any
              )._id.toString(),

            orderId:
              orderDoc._id.toString(),

            amount: Number(
              (
                existingPayment as any
              ).amount ||
                orderDoc.totalAmount ||
                0
            ),

            paymentStatus: "PAID",

            successUrl:
              `/payment/${orderDoc._id.toString()}/success`,

            receiptUrl:
              `/order/${orderDoc._id.toString()}/receipt`,
          },
        },
        {
          status: 200,
        }
      );
    }

    if (
      orderDoc.paymentStatus === "PAID"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This order is marked as paid, but its payment record could not be found.",
        },
        {
          status: 409,
        }
      );
    }

    const amount = Number(
      orderDoc.totalAmount || 0
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The order payment amount is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    previousPaymentStatus =
      orderDoc.paymentStatus || "PENDING";

    const paidAt = new Date();

    /*
     * Atomically lock the order by changing
     * its payment status to PAID.
     *
     * If two requests are submitted at the
     * same time, only one request succeeds.
     */
    const lockedOrder =
      await Order.findOneAndUpdate(
        {
          _id: orderDoc._id,

          paymentType: "PAY_NOW",

          paymentStatus: {
            $ne: "PAID",
          },

          status: {
            $ne: "CANCELLED",
          },
        },
        {
          $set: {
            paymentStatus: "PAID",
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!lockedOrder) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This payment is already being processed or has already been completed.",
        },
        {
          status: 409,
        }
      );
    }

    lockedOrderId =
      lockedOrder._id as mongoose.Types.ObjectId;

    /*
     * Create one single-order online payment.
     *
     * diningSession stays null because this
     * is not a combined cashier payment.
     */
    const payment =
      await Payment.create({
        order: lockedOrder._id,
        orders: [],
        diningSession: null,

        amount,
        method: "ONLINE",
        status: "PAID",
        paidAt,
        note,
      });

    /*
     * Add a payment note to the order history
     * without changing the operational order
     * status.
     */
    await Order.updateOne(
      {
        _id: lockedOrder._id,
      },
      {
        $push: {
          statusHistory: {
            fromStatus:
              lockedOrder.status,

            toStatus:
              lockedOrder.status,

            changedBy: null,
            changedByName: "Customer",
            changedByRole: "CUSTOMER",

            note:
              "Customer completed mock online payment.",

            changedAt: paidAt,
          },
        },
      }
    );

    const tableName =
      orderDoc.table &&
      typeof orderDoc.table === "object" &&
      orderDoc.table.name
        ? String(orderDoc.table.name)
        : orderDoc.orderType ===
            "TAKE_AWAY"
          ? "Takeaway"
          : "Dine-in order";

    await createAuditLog({
      action:
        "ONLINE_PAYMENT_COMPLETED",

      module: "PAYMENTS",

      description:
        `Mock online payment completed for ` +
        `Order #${orderDoc._id
          .toString()
          .slice(-6)
          .toUpperCase()} ` +
        `(${tableName}). Amount: Rs. ${amount}.`,

      performedBy: "Customer",

      metadata: {
        orderId:
          orderDoc._id.toString(),

        paymentId:
          payment._id.toString(),

        amount,
        method: "ONLINE",
      },
    });

    /*
     * Refresh customer and staff pages.
     */
    revalidatePath(
      `/payment/${orderDoc._id.toString()}`
    );

    revalidatePath(
      `/payment/${orderDoc._id.toString()}/success`
    );

    revalidatePath(
      `/order/${orderDoc._id.toString()}/receipt`
    );

    revalidatePath("/cashier/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/takeaway");

    revalidatePath(
      "/table/[qrCode]",
      "page"
    );

    return NextResponse.json(
      {
        success: true,

        message:
          "Payment completed successfully.",

        data: {
          paymentId:
            payment._id.toString(),

          orderId:
            orderDoc._id.toString(),

          amount,
          paymentStatus: "PAID",

          successUrl:
            `/payment/${orderDoc._id.toString()}/success`,

          receiptUrl:
            `/order/${orderDoc._id.toString()}/receipt`,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Public payment POST error:",
      error
    );

    /*
     * If payment-record creation fails after
     * locking the order, restore its previous
     * payment status.
     */
    if (lockedOrderId) {
      try {
        const paidPaymentExists =
          await Payment.exists({
            order: lockedOrderId,
            status: "PAID",
          });

        if (!paidPaymentExists) {
          await Order.updateOne(
            {
              _id: lockedOrderId,
            },
            {
              $set: {
                paymentStatus:
                  previousPaymentStatus,
              },
            }
          );
        }
      } catch (rollbackError) {
        console.error(
          "Payment rollback error:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to complete the payment.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}