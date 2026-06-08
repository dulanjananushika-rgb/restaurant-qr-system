import { NextResponse } from "next/server";
import crypto from "crypto";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
import Table from "@/models/Table";
import RecipeItem from "@/models/RecipeItem";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

type OrderRequestItem = {
  menuItemId: string;
  quantity: number;
};

type ComboOrderRequestItem = {
  comboOfferId: string;
  quantity: number;
};

type StockMovementDraft = {
  inventoryItem: any;
  type: "ORDER_DEDUCTION";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceType: "ORDER";
};

function isComboActive(combo: any) {
  if (!combo.active) return false;

  const now = new Date();

  if (combo.startDate && new Date(combo.startDate) > now) {
    return false;
  }

  if (combo.endDate && new Date(combo.endDate) < now) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const {
      tableId,
      items = [],
      comboItems = [],
      paymentType,
      customerName = "",
      customerPhone = "",
    } = body as {
      tableId: string;
      items?: OrderRequestItem[];
      comboItems?: ComboOrderRequestItem[];
      paymentType: "PAY_NOW" | "PAY_LATER";
      customerName?: string;
      customerPhone?: string;
    };

    if (!tableId) {
      return NextResponse.json(
        {
          success: false,
          message: "Table is required",
        },
        { status: 400 }
      );
    }

    if (
      (!items || items.length === 0) &&
      (!comboItems || comboItems.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one item to order",
        },
        { status: 400 }
      );
    }

    if (!paymentType || !["PAY_NOW", "PAY_LATER"].includes(paymentType)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid payment type is required",
        },
        { status: 400 }
      );
    }

    const table = await Table.findById(tableId);

    if (!table) {
      return NextResponse.json(
        {
          success: false,
          message: "Table not found",
        },
        { status: 404 }
      );
    }

    /*
      1. NORMAL MENU ITEMS
    */

    const cleanedItems = items
      .filter((item) => item.menuItemId && Number(item.quantity) > 0)
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
      }));

    const menuItemIds = cleanedItems.map((item) => item.menuItemId);

    const menuItems =
      menuItemIds.length > 0
        ? await MenuItem.find({
            _id: { $in: menuItemIds },
            available: true,
          })
        : [];

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some menu items are not available",
        },
        { status: 400 }
      );
    }

    const orderItems = cleanedItems.map((item) => {
      const menuItem = menuItems.find(
        (menu: any) => menu._id.toString() === item.menuItemId
      );

      if (!menuItem) {
        throw new Error("Invalid menu item");
      }

      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        price: Number(menuItem.price || 0),
      };
    });

    /*
      2. COMBO ITEMS
    */

    const cleanedComboItems = comboItems
      .filter((item) => item.comboOfferId && Number(item.quantity) > 0)
      .map((item) => ({
        comboOfferId: item.comboOfferId,
        quantity: Number(item.quantity),
      }));

    const comboOfferIds = cleanedComboItems.map((item) => item.comboOfferId);

    const comboOffers =
      comboOfferIds.length > 0
        ? await ComboOffer.find({
            _id: { $in: comboOfferIds },
          }).populate("items.menuItem")
        : [];

    if (comboOffers.length !== comboOfferIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some combo offers are invalid",
        },
        { status: 400 }
      );
    }

    for (const combo of comboOffers as any[]) {
      if (!isComboActive(combo)) {
        return NextResponse.json(
          {
            success: false,
            message: `${combo.name} combo offer is not active now`,
          },
          { status: 400 }
        );
      }
    }

    const orderComboItems = cleanedComboItems.map((item) => {
      const combo = (comboOffers as any[]).find(
        (offer) => offer._id.toString() === item.comboOfferId
      );

      if (!combo) {
        throw new Error("Invalid combo offer");
      }

      return {
        comboOffer: combo._id,
        quantity: item.quantity,
        price: Number(combo.offerPrice || 0),
        originalPrice: Number(combo.originalPrice || 0),
        comboItemsSnapshot: combo.items.map((comboItem: any) => ({
          menuItem: comboItem.menuItem._id,
          name: comboItem.menuItem.name,
          quantity: Number(comboItem.quantity || 0),
          priceSnapshot: Number(comboItem.priceSnapshot || 0),
        })),
      };
    });

    /*
      3. TOTAL AMOUNT
    */

    const normalItemsTotal = orderItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    const comboItemsTotal = orderComboItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    const totalAmount = normalItemsTotal + comboItemsTotal;

    /*
      4. INVENTORY DEDUCTION PREPARATION
    */

    const menuDeductionMap = new Map<string, number>();

    for (const orderItem of orderItems) {
      const menuItemId = orderItem.menuItem.toString();
      const currentQuantity = menuDeductionMap.get(menuItemId) || 0;

      menuDeductionMap.set(menuItemId, currentQuantity + orderItem.quantity);
    }

    for (const comboOrderItem of orderComboItems) {
      for (const comboMenuItem of comboOrderItem.comboItemsSnapshot) {
        const menuItemId = comboMenuItem.menuItem.toString();

        const requiredMenuQuantity =
          Number(comboMenuItem.quantity || 0) * Number(comboOrderItem.quantity || 0);

        const currentQuantity = menuDeductionMap.get(menuItemId) || 0;

        menuDeductionMap.set(
          menuItemId,
          currentQuantity + requiredMenuQuantity
        );
      }
    }

    const allMenuItemIdsForRecipes = Array.from(menuDeductionMap.keys());

    const recipes = await RecipeItem.find({
      menuItem: { $in: allMenuItemIdsForRecipes },
    }).lean();

    const deductionMap = new Map<string, number>();

    for (const [menuItemId, orderedMenuQuantity] of menuDeductionMap.entries()) {
      const itemRecipes = recipes.filter(
        (recipe: any) => recipe.menuItem.toString() === menuItemId
      );

      for (const recipe of itemRecipes as any[]) {
        const inventoryItemId = recipe.inventoryItem.toString();

        const requiredQuantity =
          Number(recipe.requiredQuantity || 0) * Number(orderedMenuQuantity || 0);

        const currentRequired = deductionMap.get(inventoryItemId) || 0;

        deductionMap.set(inventoryItemId, currentRequired + requiredQuantity);
      }
    }

    /*
      5. CHECK STOCK + PREPARE MOVEMENT DRAFTS
    */

    const stockMovementDrafts: StockMovementDraft[] = [];

    for (const [inventoryItemId, requiredQuantity] of deductionMap.entries()) {
      const inventoryItem = await InventoryItem.findById(inventoryItemId);

      if (!inventoryItem) {
        return NextResponse.json(
          {
            success: false,
            message: "Inventory item not found",
          },
          { status: 400 }
        );
      }

      const previousQuantity = Number(inventoryItem.quantity || 0);

      if (previousQuantity < requiredQuantity) {
        return NextResponse.json(
          {
            success: false,
            message: `Not enough stock for ${inventoryItem.name}. Required: ${requiredQuantity} ${inventoryItem.unit}, Available: ${previousQuantity} ${inventoryItem.unit}`,
          },
          { status: 400 }
        );
      }

      const newQuantity = previousQuantity - requiredQuantity;

      stockMovementDrafts.push({
        inventoryItem: inventoryItem._id,
        type: "ORDER_DEDUCTION",
        quantity: -requiredQuantity,
        previousQuantity,
        newQuantity,
        reason: `Stock deducted for customer order. Required: ${requiredQuantity} ${inventoryItem.unit}`,
        referenceType: "ORDER",
      });
    }

    /*
      6. DEDUCT STOCK
    */

    for (const [inventoryItemId, requiredQuantity] of deductionMap.entries()) {
      await InventoryItem.findByIdAndUpdate(inventoryItemId, {
        $inc: {
          quantity: -requiredQuantity,
        },
      });
    }

    /*
      7. CREATE ORDER WITH EDIT TOKEN
    */

    const customerEditToken = crypto.randomBytes(24).toString("hex");

    const order = await Order.create({
      table: table._id,
      orderType: "DINE_IN",
      customerName,
      customerPhone,
      items: orderItems,
      comboItems: orderComboItems,
      totalAmount,
      status: "PENDING",
      paymentType,

      /*
        PAY_NOW should not be PAID immediately.
        It becomes PAID only after mock/real payment success.
      */
      paymentStatus: paymentType === "PAY_NOW" ? "PENDING" : "UNPAID",

      /*
        Customer can edit only before kitchen accepts the order.
      */
      customerEditToken,

      statusHistory: [
        {
          fromStatus: "",
          toStatus: "PENDING",
          changedByName: "Customer",
          changedByRole: "CUSTOMER",
          note:
            paymentType === "PAY_NOW"
              ? "Customer placed order and selected Pay Now"
              : "Customer placed order and selected Pay Later",
          changedAt: new Date(),
        },
      ],
    });

    table.status = "OCCUPIED";
    await table.save();

    /*
      8. CREATE STOCK MOVEMENT HISTORY FOR ORDER DEDUCTION
    */

    if (stockMovementDrafts.length > 0) {
      await StockMovement.insertMany(
        stockMovementDrafts.map((movement) => ({
          ...movement,
          referenceId: order._id,
        }))
      );
    }

    /*
      9. AUDIT LOG
    */

    await createAuditLog({
      action: "ORDER_PLACED",
      module: "PUBLIC_ORDER",
      description: `New order placed for ${table.name}. Total: Rs. ${totalAmount}. Normal items: ${orderItems.length}, Combo items: ${orderComboItems.length}. Stock movements created: ${stockMovementDrafts.length}.`,
      performedBy: "Customer",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Order placed successfully",
        data: {
          orderId: order._id.toString(),
          editToken: customerEditToken,
          totalAmount,
          paymentType: order.paymentType,
          paymentStatus: order.paymentStatus,
          status: order.status,
          normalItemsCount: orderItems.length,
          comboItemsCount: orderComboItems.length,
          stockMovementsCount: stockMovementDrafts.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Public order create error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to place order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}