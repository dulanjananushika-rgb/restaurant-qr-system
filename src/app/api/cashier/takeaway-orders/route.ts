import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

import {
  deductStockForOrder,
  restoreStockForOrder,
  validateStockForItems,
} from "@/lib/inventory";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
import User from "@/models/User";

type PaymentType = "PAY_NOW" | "PAY_LATER";
type CounterPaymentMethod = "CASH" | "CARD";

type OrderRequestItem = {
  menuItemId?: string;
  quantity?: number;
};

type ComboOrderRequestItem = {
  comboOfferId?: string;
  quantity?: number;
};

type TakeawayRequestBody = {
  customerName?: string;
  customerPhone?: string;
  paymentType?: PaymentType;
  paymentMethod?: CounterPaymentMethod;
  paymentNote?: string;
  items?: OrderRequestItem[];
  comboItems?: ComboOrderRequestItem[];
};

type StockOrderItem = {
  menuItemId: string;
  quantity: number;
};

function sanitizeText(
  value: unknown,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function isComboActive(combo: any): boolean {
  if (!combo.active) {
    return false;
  }

  const now = new Date();

  if (
    combo.startDate &&
    new Date(combo.startDate) > now
  ) {
    return false;
  }

  if (
    combo.endDate &&
    new Date(combo.endDate) < now
  ) {
    return false;
  }

  return true;
}

function normalizeQuantity(value: unknown): number {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 50
  ) {
    return 0;
  }

  return quantity;
}

/*
 * Combine duplicate menu item IDs.
 *
 * Example:
 * [{ id: A, qty: 1 }, { id: A, qty: 2 }]
 * becomes:
 * [{ id: A, qty: 3 }]
 */
function aggregateMenuItems(
  items: OrderRequestItem[]
): Array<{
  menuItemId: string;
  quantity: number;
}> {
  const quantityMap = new Map<string, number>();

  for (const item of items) {
    const menuItemId = sanitizeText(
      item.menuItemId,
      100
    );

    const quantity = normalizeQuantity(
      item.quantity
    );

    if (!menuItemId || quantity === 0) {
      continue;
    }

    quantityMap.set(
      menuItemId,
      (quantityMap.get(menuItemId) || 0) +
        quantity
    );
  }

  return Array.from(quantityMap.entries()).map(
    ([menuItemId, quantity]) => ({
      menuItemId,
      quantity,
    })
  );
}

function aggregateComboItems(
  items: ComboOrderRequestItem[]
): Array<{
  comboOfferId: string;
  quantity: number;
}> {
  const quantityMap = new Map<string, number>();

  for (const item of items) {
    const comboOfferId = sanitizeText(
      item.comboOfferId,
      100
    );

    const quantity = normalizeQuantity(
      item.quantity
    );

    if (!comboOfferId || quantity === 0) {
      continue;
    }

    quantityMap.set(
      comboOfferId,
      (quantityMap.get(comboOfferId) || 0) +
        quantity
    );
  }

  return Array.from(quantityMap.entries()).map(
    ([comboOfferId, quantity]) => ({
      comboOfferId,
      quantity,
    })
  );
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

export async function POST(
  request: NextRequest
) {
  let createdOrderId: string | null = null;
  let stockWasDeducted = false;
  let stockItemsForRollback: StockOrderItem[] =
    [];

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

    const { authUser } = authenticatedUser;

    /* =========================
       Request data
    ========================= */

    const body =
      (await request.json()) as TakeawayRequestBody;

    const customerName = sanitizeText(
      body.customerName,
      80
    );

    const customerPhone = sanitizeText(
      body.customerPhone,
      20
    );

    const paymentNote = sanitizeText(
      body.paymentNote,
      300
    );

    const paymentType = body.paymentType;

    const paymentMethod =
      body.paymentMethod;

    /*
     * Customer name is useful for calling
     * the customer when the order is ready.
     */
    if (customerName.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer name is required for a takeaway order.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Phone is optional, but validate it
     * when the cashier enters a value.
     */
    if (
      customerPhone &&
      !/^[0-9+\-\s()]{7,20}$/.test(
        customerPhone
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please enter a valid customer phone number.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      paymentType !== "PAY_NOW" &&
      paymentType !== "PAY_LATER"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select a valid payment type.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Because this is an in-restaurant
     * counter order, only cash and card
     * are accepted here.
     */
    if (
      paymentType === "PAY_NOW" &&
      paymentMethod !== "CASH" &&
      paymentMethod !== "CARD"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select CASH or CARD for Pay Now.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanedItems = aggregateMenuItems(
      Array.isArray(body.items)
        ? body.items
        : []
    );

    const cleanedComboItems =
      aggregateComboItems(
        Array.isArray(body.comboItems)
          ? body.comboItems
          : []
      );

    if (
      cleanedItems.length === 0 &&
      cleanedComboItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please add at least one menu item or combo offer.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      cleanedItems.length +
        cleanedComboItems.length >
      50
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A maximum of 50 different items can be added to one order.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       Validate IDs
    ========================= */

    const invalidMenuItemId =
      cleanedItems.find(
        (item) =>
          !mongoose.Types.ObjectId.isValid(
            item.menuItemId
          )
      );

    if (invalidMenuItemId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more menu item IDs are invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const invalidComboId =
      cleanedComboItems.find(
        (item) =>
          !mongoose.Types.ObjectId.isValid(
            item.comboOfferId
          )
      );

    if (invalidComboId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more combo offer IDs are invalid.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       Load menu items
    ========================= */

    const menuItemIds = cleanedItems.map(
      (item) => item.menuItemId
    );

    const menuItems =
      menuItemIds.length > 0
        ? await MenuItem.find({
            _id: {
              $in: menuItemIds,
            },
            available: true,
          }).lean()
        : [];

    if (
      menuItems.length !==
      menuItemIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Some selected menu items are unavailable.",
        },
        {
          status: 400,
        }
      );
    }

    const orderItems =
      cleanedItems.map((item) => {
        const menuItem = (
          menuItems as any[]
        ).find(
          (currentMenuItem) =>
            currentMenuItem._id.toString() ===
            item.menuItemId
        );

        if (!menuItem) {
          throw new Error(
            "Selected menu item was not found."
          );
        }

        return {
          menuItem: menuItem._id,
          quantity: item.quantity,
          price: Number(
            menuItem.price || 0
          ),
        };
      });

    /* =========================
       Load combo offers
    ========================= */

    const comboOfferIds =
      cleanedComboItems.map(
        (item) => item.comboOfferId
      );

    const comboOffers =
      comboOfferIds.length > 0
        ? await ComboOffer.find({
            _id: {
              $in: comboOfferIds,
            },
          })
            .populate("items.menuItem")
            .lean()
        : [];

    if (
      comboOffers.length !==
      comboOfferIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Some selected combo offers were not found.",
        },
        {
          status: 400,
        }
      );
    }

    for (const combo of comboOffers as any[]) {
      if (!isComboActive(combo)) {
        return NextResponse.json(
          {
            success: false,
            message: `${combo.name} is not currently active.`,
          },
          {
            status: 400,
          }
        );
      }

      const containsUnavailableItem =
        combo.items?.some(
          (comboItem: any) =>
            !comboItem.menuItem ||
            comboItem.menuItem.available ===
              false
        );

      if (containsUnavailableItem) {
        return NextResponse.json(
          {
            success: false,
            message: `${combo.name} contains an unavailable menu item.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const orderComboItems =
      cleanedComboItems.map((item) => {
        const combo = (
          comboOffers as any[]
        ).find(
          (currentCombo) =>
            currentCombo._id.toString() ===
            item.comboOfferId
        );

        if (!combo) {
          throw new Error(
            "Selected combo offer was not found."
          );
        }

        return {
          comboOffer: combo._id,
          quantity: item.quantity,
          price: Number(
            combo.offerPrice || 0
          ),
          originalPrice: Number(
            combo.originalPrice || 0
          ),

          comboItemsSnapshot:
            combo.items.map(
              (comboItem: any) => ({
                menuItem:
                  comboItem.menuItem._id,

                name:
                  comboItem.menuItem.name,

                quantity: Number(
                  comboItem.quantity || 0
                ),

                priceSnapshot: Number(
                  comboItem.priceSnapshot ||
                    comboItem.menuItem
                      .price ||
                    0
                ),
              })
            ),
        };
      });

    /* =========================
       Inventory requirements
    ========================= */

    const stockItems: StockOrderItem[] =
      cleanedItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }));

    for (const cleanedComboItem of cleanedComboItems) {
      const combo = (
        comboOffers as any[]
      ).find(
        (currentCombo) =>
          currentCombo._id.toString() ===
          cleanedComboItem.comboOfferId
      );

      if (!combo) {
        continue;
      }

      for (const comboItem of combo.items) {
        stockItems.push({
          menuItemId:
            comboItem.menuItem._id.toString(),

          quantity:
            Number(
              comboItem.quantity || 0
            ) *
            cleanedComboItem.quantity,
        });
      }
    }

    stockItemsForRollback = stockItems;

    const stockCheck =
      await validateStockForItems(
        stockItems
      );

    if (!stockCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            stockCheck.message ||
            "Insufficient stock for this order.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       Calculate total on server
    ========================= */

    const normalItemsTotal =
      orderItems.reduce(
        (sum, item) =>
          sum +
          Number(item.price) *
            Number(item.quantity),
        0
      );

    const comboItemsTotal =
      orderComboItems.reduce(
        (sum, item) =>
          sum +
          Number(item.price) *
            Number(item.quantity),
        0
      );

    const totalAmount =
      normalItemsTotal +
      comboItemsTotal;

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

    /* =========================
       Create takeaway order
    ========================= */

    const order = await Order.create({
      /*
       * Takeaway orders are never linked
       * to dining tables.
       */
      table: null,

      orderType: "TAKE_AWAY",

      customerName,
      customerPhone,

      items: orderItems,
      comboItems: orderComboItems,

      totalAmount,

      status: "PENDING",

      paymentType,

      paymentStatus:
        paymentType === "PAY_NOW"
          ? "PAID"
          : "UNPAID",

      statusHistory: [
        {
          fromStatus: "",
          toStatus: "PENDING",

          changedBy: authUser.id,
          changedByName: authUser.name,
          changedByRole: authUser.role,

          note:
            "Takeaway order created at the cashier counter.",

          changedAt: new Date(),
        },
      ],
    });

    createdOrderId =
      order._id.toString();

    /* =========================
       Deduct inventory
    ========================= */

    await deductStockForOrder(
      stockItems,
      createdOrderId,
      "Stock deducted for cashier takeaway order"
    );

    stockWasDeducted = true;

    /* =========================
       Pay Now payment
    ========================= */

    let paymentId: string | null = null;

    if (
      paymentType === "PAY_NOW" &&
      paymentMethod
    ) {
      const payment =
        await Payment.create({
          order: order._id,
          amount: totalAmount,
          method: paymentMethod,
          status: "PAID",
          paidAt: new Date(),

          note:
            paymentNote ||
            "Paid at takeaway counter",
        });

      paymentId =
        payment._id.toString();
    }

    const pickupNumber =
      order._id
        .toString()
        .slice(-6)
        .toUpperCase();

    await createAuditLog({
      action:
        "TAKEAWAY_ORDER_CREATED",

      module: "CASHIER",

      description:
        `${authUser.name} created Takeaway Order #${pickupNumber} ` +
        `for ${customerName}. Total: Rs. ${totalAmount}.`,

      performedBy:
        authUser.email,

      metadata: {
        orderId: createdOrderId,
        pickupNumber,
        orderType: "TAKE_AWAY",
        customerName,
        customerPhone:
          customerPhone || null,
        totalAmount,
        paymentType,
        paymentMethod:
          paymentMethod || null,
        paymentId,
      },
    });

    return NextResponse.json(
      {
        success: true,

        message:
          paymentType === "PAY_NOW"
            ? "Takeaway order created and payment completed."
            : "Takeaway order created. Payment is due at pickup.",

        data: {
          orderId: createdOrderId,
          pickupNumber,

          orderType: "TAKE_AWAY",
          table: null,

          customerName,
          customerPhone,

          totalAmount,

          orderStatus: "PENDING",
          paymentType,

          paymentStatus:
            paymentType === "PAY_NOW"
              ? "PAID"
              : "UNPAID",

          paymentMethod:
            paymentMethod || null,

          paymentId,

          receiptUrl:
            paymentType === "PAY_NOW"
              ? `/cashier/receipt/${createdOrderId}`
              : null,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Cashier takeaway order error:",
      error
    );

    /*
     * Compensation rollback:
     *
     * If payment or another later step fails,
     * restore deducted inventory and remove
     * the incomplete order.
     */
    if (createdOrderId) {
      try {
        await Payment.deleteMany({
          order: createdOrderId,
        });

        if (stockWasDeducted) {
          await restoreStockForOrder(
            stockItemsForRollback,
            createdOrderId,
            "Stock restored because takeaway order creation failed"
          );
        }

        await Order.findByIdAndDelete(
          createdOrderId
        );
      } catch (rollbackError) {
        console.error(
          "Takeaway rollback error:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create takeaway order.",
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