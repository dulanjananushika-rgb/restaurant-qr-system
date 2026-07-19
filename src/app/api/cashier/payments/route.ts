import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Table from "@/models/Table";
import DiningSession from "@/models/DiningSession";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaymentMethod = "CASH" | "CARD" | "ONLINE";

type PaymentRequestBody = {
  orderId?: string;
  diningSessionId?: string;
  method?: PaymentMethod;
  note?: string;
};

function sanitizeNote(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 500);
}

async function getAuthenticatedCashier(
  request: NextRequest
) {
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

async function releaseLegacyTableIfSafe(
  order: any
) {
  if (
    !order.table ||
    order.orderType !== "DINE_IN" ||
    order.status !== "DELIVERED"
  ) {
    return;
  }

  const tableId =
    typeof order.table === "object"
      ? order.table._id
      : order.table;

  /*
   * Keep the table occupied if another
   * unpaid or incomplete dine-in order exists.
   */
  const blockingOrder = await Order.exists({
    _id: {
      $ne: order._id,
    },

    table: tableId,
    orderType: "DINE_IN",

    status: {
      $ne: "CANCELLED",
    },

    $or: [
      {
        status: {
          $ne: "DELIVERED",
        },
      },
      {
        paymentStatus: {
          $ne: "PAID",
        },
      },
    ],
  });

  if (!blockingOrder) {
    await Table.findByIdAndUpdate(tableId, {
      status: "AVAILABLE",
    });
  }
}

/*
 * Settle all unpaid orders in one dining session.
 */
async function settleDiningSession({
  diningSessionId,
  method,
  note,
  authUser,
  activeUser,
}: {
  diningSessionId: string;
  method: PaymentMethod;
  note: string;
  authUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  activeUser: any;
}) {
  if (
    !mongoose.Types.ObjectId.isValid(
      diningSessionId
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid dining session ID.",
      },
      {
        status: 400,
      }
    );
  }

  const diningSession =
    await DiningSession.findById(
      diningSessionId
    ).populate("table");

  if (!diningSession) {
    return NextResponse.json(
      {
        success: false,
        message: "Dining session not found.",
      },
      {
        status: 404,
      }
    );
  }

  const sessionDoc = diningSession as any;

  if (
    sessionDoc.status === "CLOSED" ||
    sessionDoc.paymentStatus === "PAID"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This dining session is already paid and closed.",
      },
      {
        status: 409,
      }
    );
  }

  const sessionOrders = await Order.find({
    diningSession: sessionDoc._id,
    orderType: "DINE_IN",

    status: {
      $ne: "CANCELLED",
    },
  })
    .sort({
      createdAt: 1,
    })
    .populate("table");

  if (sessionOrders.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          "No orders were found in this dining session.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * A final table bill should be settled only
   * after all non-cancelled orders are delivered.
   */
  const incompleteOrders =
    sessionOrders.filter(
      (order: any) =>
        order.status !== "DELIVERED"
    );

  if (incompleteOrders.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          `${incompleteOrders.length} order(s) are not delivered yet. ` +
          "Deliver all table orders before settling the final bill.",
      },
      {
        status: 409,
      }
    );
  }

  const unpaidOrders = sessionOrders.filter(
    (order: any) =>
      order.paymentStatus !== "PAID"
  );

  if (unpaidOrders.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          "All orders in this dining session are already paid.",
      },
      {
        status: 409,
      }
    );
  }

  const payableAmount = unpaidOrders.reduce(
    (total: number, order: any) =>
      total + Number(order.totalAmount || 0),
    0
  );

  if (
    !Number.isFinite(payableAmount) ||
    payableAmount <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The combined bill amount is invalid.",
      },
      {
        status: 400,
      }
    );
  }

  const paidAt = new Date();

  /*
   * Lock the session before creating the payment.
   *
   * Only one cashier request can change an OPEN,
   * UNPAID session into CLOSED and PAID.
   */
  const lockedSession =
    await DiningSession.findOneAndUpdate(
      {
        _id: sessionDoc._id,
        status: "OPEN",
        paymentStatus: "UNPAID",
      },
      {
        $set: {
          status: "CLOSED",
          paymentStatus: "PAID",
          closedAt: paidAt,
        },
      },
      {
        new: true,
      }
    );

  if (!lockedSession) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This bill is already being processed or has already been paid.",
      },
      {
        status: 409,
      }
    );
  }

  const originalPaymentStatuses =
    unpaidOrders.map((order: any) => ({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
    }));

  let paymentId:
    | mongoose.Types.ObjectId
    | null = null;

  const tableId =
    sessionDoc.table &&
    typeof sessionDoc.table === "object"
      ? sessionDoc.table._id
      : sessionDoc.table;

  try {
    const orderIds = unpaidOrders.map(
      (order: any) => order._id
    );

    const payment = await Payment.create({
      order: null,
      orders: orderIds,
      diningSession: sessionDoc._id,

      amount: payableAmount,
      method,
      status: "PAID",
      paidAt,
      note,
    });

    paymentId =
      payment._id as mongoose.Types.ObjectId;

    await Order.updateMany(
      {
        _id: {
          $in: orderIds,
        },

        paymentStatus: {
          $ne: "PAID",
        },
      },
      {
        $set: {
          paymentStatus: "PAID",
        },
      }
    );

    /*
     * The final payment is allowed only after
     * all orders are delivered, so the table
     * can now safely become available.
     */
    if (tableId) {
      await Table.findByIdAndUpdate(tableId, {
        status: "AVAILABLE",
      });
    }

    const tableName =
      sessionDoc.table &&
      typeof sessionDoc.table === "object"
        ? sessionDoc.table.name
        : "Dining table";

    await createAuditLog({
      action: "DINING_SESSION_PAYMENT_SETTLED",
      module: "CASHIER",

      description:
        `${authUser.name} settled the combined bill for ` +
        `${tableName}. ${unpaidOrders.length} order(s), ` +
        `amount Rs. ${payableAmount}, method ${method}.`,

      performedBy:
        activeUser.email ||
        activeUser.name ||
        authUser.email,

      metadata: {
        diningSessionId:
          sessionDoc._id.toString(),

        tableId:
          tableId?.toString() || null,

        orderIds: orderIds.map(
          (orderId: mongoose.Types.ObjectId) =>
            orderId.toString()
        ),

        orderCount: unpaidOrders.length,
        amount: payableAmount,
        method,
      },
    });

    return NextResponse.json(
      {
        success: true,

        message:
          "Combined table bill settled successfully.",

        data: {
          paymentId: payment._id.toString(),

          diningSessionId:
            sessionDoc._id.toString(),

          orderIds: orderIds.map(
            (orderId: mongoose.Types.ObjectId) =>
              orderId.toString()
          ),

          orderCount: unpaidOrders.length,
          amount: payableAmount,
          method,
          paymentStatus: "PAID",

          receiptUrl:
            `/cashier/receipt/session/${sessionDoc._id.toString()}`,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    /*
     * Restore the database if a later operation
     * fails after the session was locked.
     */
    if (paymentId) {
      await Payment.deleteOne({
        _id: paymentId,
      }).catch(() => undefined);
    }

    if (originalPaymentStatuses.length > 0) {
      await Order.bulkWrite(
        originalPaymentStatuses.map(
          (item) => ({
            updateOne: {
              filter: {
                _id: item.orderId,
              },

              update: {
                $set: {
                  paymentStatus:
                    item.paymentStatus,
                },
              },
            },
          })
        )
      ).catch(() => undefined);
    }

    await DiningSession.findByIdAndUpdate(
      sessionDoc._id,
      {
        $set: {
          status: "OPEN",
          paymentStatus: "UNPAID",
          closedAt: null,
        },
      }
    ).catch(() => undefined);

    if (tableId) {
      await Table.findByIdAndUpdate(tableId, {
        status: "OCCUPIED",
      }).catch(() => undefined);
    }

    throw error;
  }
}

/*
 * Settle one takeaway order or one older
 * dine-in order without a dining session.
 */
async function settleSingleOrder({
  orderId,
  method,
  note,
  authUser,
  activeUser,
}: {
  orderId: string;
  method: PaymentMethod;
  note: string;
  authUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  activeUser: any;
}) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
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

  const order = await Order.findById(
    orderId
  ).populate("table");

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

  /*
   * New dine-in orders with a dining session
   * must be paid as one combined table bill.
   */
  if (
    orderDoc.orderType === "DINE_IN" &&
    orderDoc.diningSession
  ) {
    return NextResponse.json(
      {
        success: false,

        message:
          "This order belongs to a dining session. " +
          "Please settle the combined table bill.",

        data: {
          diningSessionId:
            orderDoc.diningSession.toString(),
        },
      },
      {
        status: 400,
      }
    );
  }

  if (orderDoc.status === "CANCELLED") {
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

  if (orderDoc.paymentStatus === "PAID") {
    return NextResponse.json(
      {
        success: false,
        message: "This order is already paid.",
      },
      {
        status: 409,
      }
    );
  }

  if (
    orderDoc.orderType === "DINE_IN" &&
    orderDoc.status !== "DELIVERED"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Deliver the dine-in order before settling the bill.",
      },
      {
        status: 409,
      }
    );
  }

  const existingPayment =
    await Payment.findOne({
      status: "PAID",

      $or: [
        {
          order: orderDoc._id,
        },
        {
          orders: orderDoc._id,
        },
      ],
    }).lean();

  if (existingPayment) {
    return NextResponse.json(
      {
        success: false,
        message:
          "A paid payment record already exists for this order.",
      },
      {
        status: 409,
      }
    );
  }

  const payableAmount = Number(
    orderDoc.totalAmount || 0
  );

  if (
    !Number.isFinite(payableAmount) ||
    payableAmount <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "The order amount is invalid.",
      },
      {
        status: 400,
      }
    );
  }

  const previousPaymentStatus =
    orderDoc.paymentStatus;

  const paidAt = new Date();

  /*
   * Atomically mark the order as paid.
   */
  const lockedOrder =
    await Order.findOneAndUpdate(
      {
        _id: orderDoc._id,

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
      }
    );

  if (!lockedOrder) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This order is already being processed or has already been paid.",
      },
      {
        status: 409,
      }
    );
  }

  let paymentId:
    | mongoose.Types.ObjectId
    | null = null;

  try {
    const payment = await Payment.create({
      order: orderDoc._id,
      orders: [],
      diningSession: null,

      amount: payableAmount,
      method,
      status: "PAID",
      paidAt,
      note,
    });

    paymentId =
      payment._id as mongoose.Types.ObjectId;

    await releaseLegacyTableIfSafe({
      ...orderDoc.toObject(),
      paymentStatus: "PAID",
    });

    const tableName =
      orderDoc.table &&
      typeof orderDoc.table === "object"
        ? orderDoc.table.name
        : orderDoc.orderType === "TAKE_AWAY"
          ? "Takeaway"
          : "No table";

    await createAuditLog({
      action: "PAYMENT_SETTLED",
      module: "CASHIER",

      description:
        `${authUser.name} settled payment for ` +
        `Order #${orderDoc._id
          .toString()
          .slice(-6)
          .toUpperCase()} ` +
        `(${tableName}) using ${method}. ` +
        `Amount: Rs. ${payableAmount}.`,

      performedBy:
        activeUser.email ||
        activeUser.name ||
        authUser.email,

      metadata: {
        orderId:
          orderDoc._id.toString(),

        amount: payableAmount,
        method,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Order payment settled successfully.",

        data: {
          paymentId: payment._id.toString(),
          orderId: orderDoc._id.toString(),

          amount: payableAmount,
          method,
          paymentStatus: "PAID",

          receiptUrl:
            `/cashier/receipt/${orderDoc._id.toString()}`,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (paymentId) {
      await Payment.deleteOne({
        _id: paymentId,
      }).catch(() => undefined);
    }

    await Order.findByIdAndUpdate(
      orderDoc._id,
      {
        $set: {
          paymentStatus:
            previousPaymentStatus,
        },
      }
    ).catch(() => undefined);

    throw error;
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    await connectDB();

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

    const body =
      (await request.json()) as PaymentRequestBody;

    const orderId =
      typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    const diningSessionId =
      typeof body.diningSessionId === "string"
        ? body.diningSessionId.trim()
        : "";

    const method = body.method;
    const note = sanitizeNote(body.note);

    if (
      !method ||
      !["CASH", "CARD", "ONLINE"].includes(
        method
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select a valid payment method.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      Boolean(orderId) ===
      Boolean(diningSessionId)
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Provide either an order ID or a dining session ID.",
        },
        {
          status: 400,
        }
      );
    }

    if (diningSessionId) {
      return settleDiningSession({
        diningSessionId,
        method,
        note,
        authUser,
        activeUser,
      });
    }

    return settleSingleOrder({
      orderId,
      method,
      note,
      authUser,
      activeUser,
    });
  } catch (error) {
    console.error(
      "Cashier payment POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to settle the payment.",

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