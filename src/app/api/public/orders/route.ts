import crypto from "crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
import Table from "@/models/Table";
import DiningSession from "@/models/DiningSession";
import RecipeItem from "@/models/RecipeItem";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderType = "DINE_IN" | "TAKE_AWAY";
type PaymentType = "PAY_NOW" | "PAY_LATER";

type OrderRequestItem = {
  menuItemId: string;
  quantity: number;
};

type ComboOrderRequestItem = {
  comboOfferId: string;
  quantity: number;
};

type OrderRequestBody = {
  tableId?: string;
  orderType?: OrderType;
  items?: OrderRequestItem[];
  comboItems?: ComboOrderRequestItem[];
  paymentType?: PaymentType;
  customerName?: string;
  customerPhone?: string;
};

type StockRequirement = {
  inventoryItemId: string;
  requiredQuantity: number;
};

type AppliedDeduction = {
  inventoryItemId: string;
  quantity: number;
};

type StockMovementDraft = {
  inventoryItem: mongoose.Types.ObjectId;
  type: "ORDER_DEDUCTION";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceType: "ORDER";
};

class StockUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockUnavailableError";
  }
}

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

/*
 * Combine duplicate normal menu items.
 *
 * Example:
 * Burger x1 + Burger x2
 * becomes Burger x3.
 */
function normalizeMenuItems(
  items: OrderRequestItem[]
): OrderRequestItem[] {
  const quantityMap = new Map<string, number>();

  for (const item of items) {
    const menuItemId =
      typeof item?.menuItemId === "string"
        ? item.menuItemId.trim()
        : "";

    const quantity = Number(item?.quantity);

    if (
      !menuItemId ||
      !mongoose.Types.ObjectId.isValid(menuItemId) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue;
    }

    quantityMap.set(
      menuItemId,
      (quantityMap.get(menuItemId) || 0) + quantity
    );
  }

  return Array.from(quantityMap.entries()).map(
    ([menuItemId, quantity]) => ({
      menuItemId,
      quantity,
    })
  );
}

/*
 * Combine duplicate combo items.
 */
function normalizeComboItems(
  comboItems: ComboOrderRequestItem[]
): ComboOrderRequestItem[] {
  const quantityMap = new Map<string, number>();

  for (const item of comboItems) {
    const comboOfferId =
      typeof item?.comboOfferId === "string"
        ? item.comboOfferId.trim()
        : "";

    const quantity = Number(item?.quantity);

    if (
      !comboOfferId ||
      !mongoose.Types.ObjectId.isValid(comboOfferId) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
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

/*
 * Find the current open dining session for the table.
 *
 * If an open session does not exist, create one.
 *
 * The unique partial index in DiningSession prevents
 * two OPEN sessions from being created for one table.
 */
async function getOrCreateDiningSession(
  tableId: mongoose.Types.ObjectId
) {
  try {
    const session =
      await DiningSession.findOneAndUpdate(
        {
          table: tableId,
          status: "OPEN",
        },
        {
          $setOnInsert: {
            table: tableId,
            status: "OPEN",
            paymentStatus: "UNPAID",
            openedAt: new Date(),
            closedAt: null,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    if (!session) {
      throw new Error(
        "Failed to create the dining session."
      );
    }

    return session;
  } catch (error: any) {
    /*
     * Two customer requests may attempt to create
     * the first session at the same time.
     *
     * When the unique index rejects one request,
     * retrieve the session created by the other request.
     */
    if (error?.code === 11000) {
      const existingSession =
        await DiningSession.findOne({
          table: tableId,
          status: "OPEN",
        });

      if (existingSession) {
        return existingSession;
      }
    }

    throw error;
  }
}

export async function POST(request: Request) {
  /*
   * These values are used to safely compensate
   * database changes if a later operation fails.
   */
  const appliedDeductions: AppliedDeduction[] = [];

  let createdOrderId:
    | mongoose.Types.ObjectId
    | null = null;

  let diningSessionId:
    | mongoose.Types.ObjectId
    | null = null;

  try {
    await connectDB();

    const body =
      (await request.json()) as OrderRequestBody;

    const orderType: OrderType =
      body.orderType || "DINE_IN";

    const paymentType = body.paymentType;

    const customerName = sanitizeText(
      body.customerName,
      100
    );

    const customerPhone = sanitizeText(
      body.customerPhone,
      30
    );

    const normalItems = normalizeMenuItems(
      Array.isArray(body.items) ? body.items : []
    );

    const requestedComboItems =
      normalizeComboItems(
        Array.isArray(body.comboItems)
          ? body.comboItems
          : []
      );

    /* =========================
       Basic validation
    ========================= */

    if (
      orderType !== "DINE_IN" &&
      orderType !== "TAKE_AWAY"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order type.",
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
            "Please select a valid payment option.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      normalItems.length === 0 &&
      requestedComboItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please add at least one item to the order.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       Validate table
    ========================= */

    let table: any = null;

    if (orderType === "DINE_IN") {
      const tableId =
        typeof body.tableId === "string"
          ? body.tableId.trim()
          : "";

      if (
        !tableId ||
        !mongoose.Types.ObjectId.isValid(tableId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "A valid table is required for dine-in orders.",
          },
          {
            status: 400,
          }
        );
      }

      table = await Table.findById(tableId);

      if (!table) {
        return NextResponse.json(
          {
            success: false,
            message: "Restaurant table not found.",
          },
          {
            status: 404,
          }
        );
      }

      if (table.status === "INACTIVE") {
        return NextResponse.json(
          {
            success: false,
            message:
              "This restaurant table is currently inactive.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =========================
       Validate normal menu items
    ========================= */

    const menuItemIds = normalItems.map(
      (item) => item.menuItemId
    );

    const menuItems =
      menuItemIds.length > 0
        ? await MenuItem.find({
            _id: {
              $in: menuItemIds,
            },
            available: true,
          })
        : [];

    if (menuItems.length !== menuItemIds.length) {
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

    const orderItems = normalItems.map((item) => {
      const menuItem = menuItems.find(
        (menu: any) =>
          menu._id.toString() === item.menuItemId
      );

      if (!menuItem) {
        throw new Error(
          "A selected menu item could not be found."
        );
      }

      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        price: Number(menuItem.price || 0),
      };
    });

    /* =========================
       Validate combo offers
    ========================= */

    const comboOfferIds =
      requestedComboItems.map(
        (item) => item.comboOfferId
      );

    const comboOffers =
      comboOfferIds.length > 0
        ? await ComboOffer.find({
            _id: {
              $in: comboOfferIds,
            },
          }).populate("items.menuItem")
        : [];

    if (
      comboOffers.length !== comboOfferIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Some selected combo offers are invalid.",
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
            message:
              `${combo.name} is not active at this time.`,
          },
          {
            status: 400,
          }
        );
      }

      const invalidComboItem = combo.items.some(
        (comboItem: any) =>
          !comboItem.menuItem ||
          !comboItem.menuItem.available
      );

      if (invalidComboItem) {
        return NextResponse.json(
          {
            success: false,
            message:
              `${combo.name} contains an unavailable menu item.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const orderComboItems =
      requestedComboItems.map((item) => {
        const combo = (
          comboOffers as any[]
        ).find(
          (offer) =>
            offer._id.toString() ===
            item.comboOfferId
        );

        if (!combo) {
          throw new Error(
            "A selected combo offer could not be found."
          );
        }

        return {
          comboOffer: combo._id,
          quantity: item.quantity,
          price: Number(combo.offerPrice || 0),
          originalPrice: Number(
            combo.originalPrice || 0
          ),

          comboItemsSnapshot: combo.items.map(
            (comboItem: any) => ({
              menuItem: comboItem.menuItem._id,
              name: comboItem.menuItem.name,
              quantity: Number(
                comboItem.quantity || 0
              ),
              priceSnapshot: Number(
                comboItem.priceSnapshot || 0
              ),
            })
          ),
        };
      });

    /* =========================
       Calculate server-side total
    ========================= */

    const normalItemsTotal = orderItems.reduce(
      (total, item) =>
        total +
        Number(item.price || 0) *
          Number(item.quantity || 0),
      0
    );

    const comboItemsTotal =
      orderComboItems.reduce(
        (total, item) =>
          total +
          Number(item.price || 0) *
            Number(item.quantity || 0),
        0
      );

    const totalAmount =
      normalItemsTotal + comboItemsTotal;

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The order total is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       Calculate menu quantities
    ========================= */

    const menuQuantityMap =
      new Map<string, number>();

    for (const item of orderItems) {
      const menuItemId =
        item.menuItem.toString();

      menuQuantityMap.set(
        menuItemId,
        (menuQuantityMap.get(menuItemId) || 0) +
          item.quantity
      );
    }

    for (const combo of orderComboItems) {
      for (const comboItem of
        combo.comboItemsSnapshot) {
        const menuItemId =
          comboItem.menuItem.toString();

        const requiredMenuQuantity =
          Number(comboItem.quantity || 0) *
          Number(combo.quantity || 0);

        menuQuantityMap.set(
          menuItemId,
          (menuQuantityMap.get(menuItemId) || 0) +
            requiredMenuQuantity
        );
      }
    }

    /* =========================
       Calculate inventory requirements
    ========================= */

    const allOrderedMenuItemIds =
      Array.from(menuQuantityMap.keys());

    const recipes = await RecipeItem.find({
      menuItem: {
        $in: allOrderedMenuItemIds,
      },
    }).lean();

    const inventoryRequirementMap =
      new Map<string, number>();

    for (const [
      menuItemId,
      orderedQuantity,
    ] of menuQuantityMap.entries()) {
      const itemRecipes = recipes.filter(
        (recipe: any) =>
          recipe.menuItem.toString() ===
          menuItemId
      );

      for (const recipe of itemRecipes as any[]) {
        const inventoryItemId =
          recipe.inventoryItem.toString();

        const requiredQuantity =
          Number(recipe.requiredQuantity || 0) *
          orderedQuantity;

        inventoryRequirementMap.set(
          inventoryItemId,
          (inventoryRequirementMap.get(
            inventoryItemId
          ) || 0) + requiredQuantity
        );
      }
    }

    const stockRequirements: StockRequirement[] =
      Array.from(
        inventoryRequirementMap.entries()
      ).map(
        ([
          inventoryItemId,
          requiredQuantity,
        ]) => ({
          inventoryItemId,
          requiredQuantity,
        })
      );

    /* =========================
       Initial stock validation
    ========================= */

    for (const requirement of stockRequirements) {
      const inventoryItem =
        await InventoryItem.findById(
          requirement.inventoryItemId
        );

      if (!inventoryItem) {
        return NextResponse.json(
          {
            success: false,
            message:
              "A required inventory item was not found.",
          },
          {
            status: 400,
          }
        );
      }

      const availableQuantity = Number(
        inventoryItem.quantity || 0
      );

      if (
        availableQuantity <
        requirement.requiredQuantity
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Not enough stock for ${inventoryItem.name}. ` +
              `Required: ${requirement.requiredQuantity} ${inventoryItem.unit}. ` +
              `Available: ${availableQuantity} ${inventoryItem.unit}.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =========================
       Get/create dining session
    ========================= */

    let diningSession: any = null;

    if (orderType === "DINE_IN" && table) {
      diningSession =
        await getOrCreateDiningSession(table._id);

      diningSessionId =
        diningSession._id as mongoose.Types.ObjectId;
    }

    /* =========================
       Atomic stock deductions
    ========================= */

    const stockMovementDrafts:
      StockMovementDraft[] = [];

    for (const requirement of stockRequirements) {
      /*
       * This update succeeds only when the current
       * stock is still sufficient.
       *
       * It protects against two orders attempting
       * to use the same final stock quantity.
       */
      const updatedInventory =
        await InventoryItem.findOneAndUpdate(
          {
            _id: requirement.inventoryItemId,

            quantity: {
              $gte: requirement.requiredQuantity,
            },
          },
          {
            $inc: {
              quantity:
                -requirement.requiredQuantity,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!updatedInventory) {
        throw new StockUnavailableError(
          "Stock changed while the order was being placed. Please try again."
        );
      }

      appliedDeductions.push({
        inventoryItemId:
          requirement.inventoryItemId,

        quantity:
          requirement.requiredQuantity,
      });

      const newQuantity = Number(
        updatedInventory.quantity || 0
      );

      const previousQuantity =
        newQuantity +
        requirement.requiredQuantity;

      stockMovementDrafts.push({
        inventoryItem:
          updatedInventory._id as mongoose.Types.ObjectId,

        type: "ORDER_DEDUCTION",

        /*
         * Negative value clearly shows stock removal.
         */
        quantity:
          -requirement.requiredQuantity,

        previousQuantity,
        newQuantity,

        reason:
          `Stock deducted for ${orderType} customer order`,

        referenceType: "ORDER",
      });
    }

    /* =========================
       Create order
    ========================= */

    const customerEditToken =
      crypto.randomBytes(24).toString("hex");

    const order = await Order.create({
      table: table ? table._id : null,

      diningSession:
        diningSession?._id || null,

      orderType,

      customerName,
      customerPhone,

      items: orderItems,
      comboItems: orderComboItems,

      totalAmount,

      status: "PENDING",

      paymentType,

      paymentStatus:
        paymentType === "PAY_NOW"
          ? "PENDING"
          : "UNPAID",

      customerEditToken,

      statusHistory: [
        {
          fromStatus: "",
          toStatus: "PENDING",
          changedBy: null,
          changedByName: "Customer",
          changedByRole: "CUSTOMER",
          note:
            orderType === "DINE_IN"
              ? `Customer placed a dine-in order for ${table.name}.`
              : "Customer placed a takeaway order.",
          changedAt: new Date(),
        },
      ],
    });

    createdOrderId =
      order._id as mongoose.Types.ObjectId;

    /* =========================
       Save stock movement history
    ========================= */

    if (stockMovementDrafts.length > 0) {
      await StockMovement.insertMany(
        stockMovementDrafts.map((movement) => ({
          ...movement,
          referenceId: order._id,
        }))
      );
    }

    /* =========================
       Update table status
    ========================= */

    if (orderType === "DINE_IN" && table) {
      await Table.updateOne(
        {
          _id: table._id,
        },
        {
          $set: {
            status: "OCCUPIED",
          },
        }
      );
    }

    /* =========================
       Audit log
    ========================= */

    await createAuditLog({
      action: "ORDER_PLACED",
      module: "PUBLIC_ORDER",

      description:
        orderType === "DINE_IN"
          ? `${orderType} order placed for ${table.name}. Total: Rs. ${totalAmount}.`
          : `${orderType} order placed. Total: Rs. ${totalAmount}.`,

      performedBy: "Customer",

      metadata: {
        orderId: order._id.toString(),

        diningSessionId:
          diningSession?._id?.toString() || null,

        tableId:
          table?._id?.toString() || null,

        tableName:
          table?.name || null,

        orderType,
        paymentType,
        totalAmount,
      },
    });

    const pickupNumber =
      order._id
        .toString()
        .slice(-6)
        .toUpperCase();

    return NextResponse.json(
      {
        success: true,
        message: "Order placed successfully.",

        data: {
          orderId: order._id.toString(),

          diningSessionId:
            diningSession?._id?.toString() ||
            null,

          editToken: customerEditToken,

          totalAmount,

          paymentType:
            order.paymentType,

          paymentStatus:
            order.paymentStatus,

          status: order.status,

          pickupNumber:
            orderType === "TAKE_AWAY"
              ? pickupNumber
              : null,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Public order creation error:",
      error
    );

    /*
     * Remove an incomplete order and its movement
     * records when a later database operation fails.
     */
    if (createdOrderId) {
      try {
        await StockMovement.deleteMany({
          referenceType: "ORDER",
          referenceId: createdOrderId,
        });

        await Order.deleteOne({
          _id: createdOrderId,
        });
      } catch (cleanupError) {
        console.error(
          "Failed to clean up incomplete order:",
          cleanupError
        );
      }
    }

    /*
     * Restore every inventory quantity that was
     * deducted before the failure.
     */
    for (
      let index = appliedDeductions.length - 1;
      index >= 0;
      index -= 1
    ) {
      const deduction =
        appliedDeductions[index];

      try {
        await InventoryItem.updateOne(
          {
            _id: deduction.inventoryItemId,
          },
          {
            $inc: {
              quantity: deduction.quantity,
            },
          }
        );
      } catch (rollbackError) {
        console.error(
          "Inventory rollback failed:",
          rollbackError
        );
      }
    }

    /*
     * Remove an empty dining session only when
     * no successful order has been attached to it.
     */
    if (diningSessionId) {
      try {
        const hasSessionOrders =
          await Order.exists({
            diningSession: diningSessionId,
          });

        if (!hasSessionOrders) {
          await DiningSession.deleteOne({
            _id: diningSessionId,
            status: "OPEN",
          });
        }
      } catch (sessionCleanupError) {
        console.error(
          "Dining session cleanup failed:",
          sessionCleanupError
        );
      }
    }

    if (error instanceof StockUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to place the order. Please try again.",

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