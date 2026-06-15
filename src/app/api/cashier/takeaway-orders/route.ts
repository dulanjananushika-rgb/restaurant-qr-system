import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
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
      customerName = "",
      customerPhone = "",
      paymentType = "PAY_LATER",
      items = [],
      comboItems = [],
    } = body as {
      customerName?: string;
      customerPhone?: string;
      paymentType?: "PAY_NOW" | "PAY_LATER";
      items?: OrderRequestItem[];
      comboItems?: ComboOrderRequestItem[];
    };

    if (
      (!items || items.length === 0) &&
      (!comboItems || comboItems.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one item to takeaway order",
        },
        { status: 400 }
      );
    }

    if (!["PAY_NOW", "PAY_LATER"].includes(paymentType)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment type",
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
      Inventory deduction
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
          Number(comboMenuItem.quantity || 0) *
          Number(comboOrderItem.quantity || 0);

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
          Number(recipe.requiredQuantity || 0) *
          Number(orderedMenuQuantity || 0);

        const currentRequired = deductionMap.get(inventoryItemId) || 0;

        deductionMap.set(inventoryItemId, currentRequired + requiredQuantity);
      }
    }

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
        reason: `Stock deducted for takeaway order. Required: ${requiredQuantity} ${inventoryItem.unit}`,
        referenceType: "ORDER",
      });
    }

    for (const [inventoryItemId, requiredQuantity] of deductionMap.entries()) {
      await InventoryItem.findByIdAndUpdate(inventoryItemId, {
        $inc: {
          quantity: -requiredQuantity,
        },
      });
    }

    const order = await Order.create({
      table: null,
      orderType: "TAKE_AWAY",
      customerName,
      customerPhone,
      items: orderItems,
      comboItems: orderComboItems,
      totalAmount,
      status: "PENDING",
      paymentType,
      paymentStatus: paymentType === "PAY_NOW" ? "PENDING" : "UNPAID",
      statusHistory: [
        {
          fromStatus: "",
          toStatus: "PENDING",
          changedByName: "Cashier",
          changedByRole: "CASHIER",
          note: "Takeaway order created from cashier workspace",
          changedAt: new Date(),
        },
      ],
    });

    if (stockMovementDrafts.length > 0) {
      await StockMovement.insertMany(
        stockMovementDrafts.map((movement) => ({
          ...movement,
          referenceId: order._id,
        }))
      );
    }

    await createAuditLog({
      action: "TAKEAWAY_ORDER_CREATED",
      module: "CASHIER",
      description: `Takeaway Order #${order._id
        .toString()
        .slice(-6)
        .toUpperCase()} created. Total: Rs. ${totalAmount}.`,
      performedBy: "Cashier",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Takeaway order created successfully",
        data: {
          orderId: order._id.toString(),
          totalAmount,
          paymentType: order.paymentType,
          paymentStatus: order.paymentStatus,
          status: order.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Takeaway order POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create takeaway order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}