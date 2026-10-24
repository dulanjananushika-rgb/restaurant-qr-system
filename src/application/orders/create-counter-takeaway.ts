import type { Types } from "mongoose";
import type { z } from "zod";

import { resolveOrderSelection } from "@/application/orders/order-selection";
import type { ActiveAuthUser } from "@/domain/auth/types";
import { aggregateQuantities, mapToMenuQuantities } from "@/domain/order/calculations";
import { createAuditLog } from "@/lib/audit";
import { runInTransaction } from "@/lib/db/transaction";
import { deductStockForOrder } from "@/lib/inventory";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import type { counterTakeawaySchema } from "@/validation/order";

type CounterTakeawayInput = z.infer<typeof counterTakeawaySchema>;

function flattenSelection(
  normalItems: Array<{ menuItem: Types.ObjectId; quantity: number }>,
  combos: Array<{
    quantity: number;
    comboItemsSnapshot: Array<{ menuItem: Types.ObjectId; quantity: number }>;
  }>
) {
  const quantities = aggregateQuantities(
    normalItems,
    (item) => item.menuItem.toString(),
    (item) => item.quantity
  );
  for (const combo of combos) {
    for (const item of combo.comboItemsSnapshot) {
      const menuItemId = item.menuItem.toString();
      const quantity = item.quantity * combo.quantity;
      quantities.set(menuItemId, (quantities.get(menuItemId) ?? 0) + quantity);
    }
  }
  return mapToMenuQuantities(quantities);
}

export async function createCounterTakeaway(
  input: CounterTakeawayInput,
  user: ActiveAuthUser
) {
  const normalQuantities = aggregateQuantities(
    input.items,
    (item) => item.menuItemId,
    (item) => item.quantity
  );
  const comboQuantities = aggregateQuantities(
    input.comboItems,
    (item) => item.comboOfferId,
    (item) => item.quantity
  );

  return runInTransaction(async (session) => {
    const selection = await resolveOrderSelection(
      normalQuantities,
      comboQuantities,
      session
    );
    const now = new Date();
    const paymentStatus = input.paymentType === "PAY_NOW" ? "PAID" : "UNPAID";

    const [order] = await Order.create(
      [
        {
          table: null,
          diningSession: null,
          orderType: "TAKE_AWAY",
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: selection.orderItems,
          comboItems: selection.orderComboItems,
          totalAmount: selection.totalAmount,
          status: "PENDING",
          paymentType: input.paymentType,
          paymentStatus,
          statusHistory: [
            {
              fromStatus: "",
              toStatus: "PENDING",
              changedBy: user.id,
              changedByName: user.name,
              changedByRole: user.role,
              note: "Takeaway order created at the cashier counter.",
              changedAt: now,
            },
          ],
        },
      ],
      { session }
    );

    const stockItems = flattenSelection(
      selection.orderItems,
      selection.orderComboItems
    );
    await deductStockForOrder(
      stockItems,
      order._id,
      "Stock deducted for cashier takeaway order",
      session
    );

    let paymentId: string | null = null;
    if (input.paymentType === "PAY_NOW" && input.paymentMethod) {
      const [payment] = await Payment.create(
        [
          {
            order: order._id,
            orders: [],
            diningSession: null,
            amount: selection.totalAmount,
            method: input.paymentMethod,
            status: "PAID",
            paidAt: now,
            note: input.paymentNote || "Paid at takeaway counter",
          },
        ],
        { session }
      );
      paymentId = payment._id.toString();
    }

    const orderId = order._id.toString();
    const pickupNumber = orderId.slice(-6).toUpperCase();
    await createAuditLog(
      {
        action: "TAKEAWAY_ORDER_CREATED",
        module: "CASHIER",
        description: `${user.name} created Takeaway Order #${pickupNumber} for ${input.customerName}. Total: Rs. ${selection.totalAmount}.`,
        performedBy: user.email,
        metadata: {
          orderId,
          pickupNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone || null,
          totalAmount: selection.totalAmount,
          paymentType: input.paymentType,
          paymentMethod: input.paymentMethod ?? null,
          paymentId,
        },
      },
      { session, failClosed: true }
    );

    return {
      orderId,
      pickupNumber,
      orderType: "TAKE_AWAY" as const,
      table: null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      totalAmount: selection.totalAmount,
      orderStatus: "PENDING" as const,
      paymentType: input.paymentType,
      paymentStatus,
      paymentMethod: input.paymentMethod ?? null,
      paymentId,
      receiptUrl:
        input.paymentType === "PAY_NOW"
          ? `/cashier/receipt/${orderId}`
          : null,
    };
  });
}
