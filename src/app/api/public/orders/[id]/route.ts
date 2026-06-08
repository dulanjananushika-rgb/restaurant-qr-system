import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";
import RecipeItem from "@/models/RecipeItem";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateOrderItem = {
  menuItemId: string;
  quantity: number;
};

type StockMovementDraft = {
  inventoryItem: any;
  type: "ORDER_DEDUCTION" | "ORDER_RESTORE";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceType: "ORDER";
  referenceId: any;
};

async function buildDeductionMap(items: UpdateOrderItem[]) {
  const menuDeductionMap = new Map<string, number>();

  for (const item of items) {
    const currentQuantity = menuDeductionMap.get(item.menuItemId) || 0;
    menuDeductionMap.set(
      item.menuItemId,
      currentQuantity + Number(item.quantity || 0)
    );
  }

  const menuItemIds = Array.from(menuDeductionMap.keys());

  const recipes = await RecipeItem.find({
    menuItem: { $in: menuItemIds },
  }).lean();

  const deductionMap = new Map<string, number>();

  for (const [menuItemId, orderedMenuQuantity] of menuDeductionMap.entries()) {
    const itemRecipes = recipes.filter(
      (recipe: any) => recipe.menuItem.toString() === menuItemId
    );

    for (const recipe of itemRecipes as any[]) {
      const inventoryItemId = recipe.inventoryItem.toString();

      const requiredQuantity =
        Number(recipe.requiredQuantity || 0) *
        Number(orderedMenuQuantity || 0);

      const currentRequired = deductionMap.get(inventoryItemId) || 0;

      deductionMap.set(inventoryItemId, currentRequired + requiredQuantity);
    }
  }

  return deductionMap;
}

async function restoreStockForExistingOrder(orderDoc: any) {
  const oldItems: UpdateOrderItem[] = (orderDoc.items || []).map((item: any) => ({
    menuItemId: item.menuItem.toString(),
    quantity: Number(item.quantity || 0),
  }));

  const restoreMap = await buildDeductionMap(oldItems);
  const stockMovements: StockMovementDraft[] = [];

  for (const [inventoryItemId, restoreQuantity] of restoreMap.entries()) {
    const inventoryItem = await InventoryItem.findById(inventoryItemId);

    if (!inventoryItem) continue;

    const previousQuantity = Number(inventoryItem.quantity || 0);
    const newQuantity = previousQuantity + Number(restoreQuantity || 0);

    await InventoryItem.findByIdAndUpdate(inventoryItemId, {
      $inc: {
        quantity: restoreQuantity,
      },
    });

    stockMovements.push({
      inventoryItem: inventoryItem._id,
      type: "ORDER_RESTORE",
      quantity: Number(restoreQuantity || 0),
      previousQuantity,
      newQuantity,
      reason: "Stock restored because customer edited pending order",
      referenceType: "ORDER",
      referenceId: orderDoc._id,
    });
  }

  if (stockMovements.length > 0) {
    await StockMovement.insertMany(stockMovements);
  }
}

async function checkStockForNewItems(items: UpdateOrderItem[]) {
  const deductionMap = await buildDeductionMap(items);

  for (const [inventoryItemId, requiredQuantity] of deductionMap.entries()) {
    const inventoryItem = await InventoryItem.findById(inventoryItemId);

    if (!inventoryItem) {
      return {
        success: false,
        message: "Inventory item not found",
      };
    }

    const availableQuantity = Number(inventoryItem.quantity || 0);

    if (availableQuantity < requiredQuantity) {
      return {
        success: false,
        message: `Not enough stock for ${inventoryItem.name}. Required: ${requiredQuantity} ${inventoryItem.unit}, Available: ${availableQuantity} ${inventoryItem.unit}`,
      };
    }
  }

  return {
    success: true,
    message: "Stock available",
  };
}

async function deductStockForNewItems(orderId: any, items: UpdateOrderItem[]) {
  const deductionMap = await buildDeductionMap(items);
  const stockMovements: StockMovementDraft[] = [];

  for (const [inventoryItemId, requiredQuantity] of deductionMap.entries()) {
    const inventoryItem = await InventoryItem.findById(inventoryItemId);

    if (!inventoryItem) continue;

    const previousQuantity = Number(inventoryItem.quantity || 0);
    const newQuantity = previousQuantity - Number(requiredQuantity || 0);

    await InventoryItem.findByIdAndUpdate(inventoryItemId, {
      $inc: {
        quantity: -requiredQuantity,
      },
    });

    stockMovements.push({
      inventoryItem: inventoryItem._id,
      type: "ORDER_DEDUCTION",
      quantity: -Number(requiredQuantity || 0),
      previousQuantity,
      newQuantity,
      reason: "Stock deducted after customer edited pending order",
      referenceType: "ORDER",
      referenceId: orderId,
    });
  }

  if (stockMovements.length > 0) {
    await StockMovement.insertMany(stockMovements);
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;

    const order = await Order.findById(id)
      .populate("table")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean();

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Public order GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const {
      editToken,
      customerName = "",
      customerPhone = "",
      items,
    } = body as {
      editToken?: string;
      customerName?: string;
      customerPhone?: string;
      items?: UpdateOrderItem[];
    };

    if (!editToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Edit token is required",
        },
        { status: 401 }
      );
    }

    const order = await Order.findById(id).select("+customerEditToken");

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    const orderDoc = order as any;

    if (orderDoc.customerEditToken !== editToken) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not allowed to edit this order",
        },
        { status: 403 }
      );
    }

    if (orderDoc.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kitchen has already accepted this order. Please place a new order for extra items.",
        },
        { status: 400 }
      );
    }

    if (orderDoc.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This order is already paid. Please place a new order for extra items.",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one item",
        },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .filter((item) => item.menuItemId && Number(item.quantity) > 0)
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add valid order items",
        },
        { status: 400 }
      );
    }

    const menuItemIds = cleanedItems.map((item) => item.menuItemId);

    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      available: true,
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some menu items are invalid or unavailable",
        },
        { status: 400 }
      );
    }

    /*
      Important flow:
      1. Restore old stock first.
      2. Check stock for new edited order.
      3. If stock check fails, deduct old stock again to rollback restore.
      4. If stock check passes, deduct new stock and update order.
    */

    const oldItems: UpdateOrderItem[] = (orderDoc.items || []).map(
      (item: any) => ({
        menuItemId: item.menuItem.toString(),
        quantity: Number(item.quantity || 0),
      })
    );

    await restoreStockForExistingOrder(orderDoc);

    const stockCheck = await checkStockForNewItems(cleanedItems);

    if (!stockCheck.success) {
      await deductStockForNewItems(orderDoc._id, oldItems);

      return NextResponse.json(
        {
          success: false,
          message: stockCheck.message,
        },
        { status: 400 }
      );
    }

    await deductStockForNewItems(orderDoc._id, cleanedItems);

    const updatedOrderItems = cleanedItems.map((item) => {
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

    const totalAmount = updatedOrderItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    orderDoc.customerName = customerName;
    orderDoc.customerPhone = customerPhone;
    orderDoc.items = updatedOrderItems;

    /*
      For now, customer edit supports normal menu items.
      Combo edit can be added later if needed.
    */
    orderDoc.comboItems = [];

    orderDoc.totalAmount = totalAmount;

    if (!Array.isArray(orderDoc.statusHistory)) {
      orderDoc.statusHistory = [];
    }

    orderDoc.statusHistory.push({
      fromStatus: "PENDING",
      toStatus: "PENDING",
      changedByName: "Customer",
      changedByRole: "CUSTOMER",
      note: "Customer edited pending order before kitchen acceptance",
      changedAt: new Date(),
    });

    await orderDoc.save();

    const populatedOrder = await Order.findById(orderDoc._id)
      .populate("table")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean();

    await createAuditLog({
      action: "CUSTOMER_ORDER_EDITED",
      module: "PUBLIC_ORDER",
      description: `Customer edited Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} before kitchen acceptance.`,
      performedBy: "Customer",
    });

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Public order PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}