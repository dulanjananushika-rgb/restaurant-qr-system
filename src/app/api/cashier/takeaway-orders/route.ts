import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
import Table from "@/models/Table";

import {
  validateStockForItems,
  deductStockForOrder,
} from "@/lib/inventory";

type OrderRequestItem = {
  menuItemId: string;
  quantity: number;
};

type ComboOrderRequestItem = {
  comboOfferId: string;
  quantity: number;
};

function isComboActive(combo: any) {
  if (!combo.active) return false;
  const now = new Date();
  if (combo.startDate && new Date(combo.startDate) > now) return false;
  if (combo.endDate && new Date(combo.endDate) < now) return false;
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
    } = body;

    if (!tableId) {
      return NextResponse.json(
        { success: false, message: "Table is required" },
        { status: 400 }
      );
    }

    if (
      (!items || items.length === 0) &&
      (!comboItems || comboItems.length === 0)
    ) {
      return NextResponse.json(
        { success: false, message: "Please add at least one item" },
        { status: 400 }
      );
    }

    if (!["PAY_NOW", "PAY_LATER"].includes(paymentType)) {
      return NextResponse.json(
        { success: false, message: "Valid payment type is required" },
        { status: 400 }
      );
    }

    const table = await Table.findById(tableId);
    if (!table) {
      return NextResponse.json(
        { success: false, message: "Table not found" },
        { status: 404 }
      );
    }

    // Prepare items for inventory
    const orderItemsForStock: any[] = [];

    // Normal items
    const cleanedItems = items
      .filter((item: any) => item.menuItemId && Number(item.quantity) > 0)
      .map((item: any) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
      }));

    const menuItemIds = cleanedItems.map((i: any) => i.menuItemId);
    const menuItems =
      menuItemIds.length > 0
        ? await MenuItem.find({ _id: { $in: menuItemIds }, available: true })
        : [];

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        { success: false, message: "Some menu items are not available" },
        { status: 400 }
      );
    }

    const orderItems = cleanedItems.map((item: any) => {
      const menuItem = menuItems.find(
        (m: any) => m._id.toString() === item.menuItemId
      );
      if (!menuItem) throw new Error("Invalid menu item");

      orderItemsForStock.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      });

      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        price: Number(menuItem.price || 0),
      };
    });

    // Combo items
    const cleanedComboItems = comboItems
      .filter((item: any) => item.comboOfferId && Number(item.quantity) > 0)
      .map((item: any) => ({
        comboOfferId: item.comboOfferId,
        quantity: Number(item.quantity),
      }));

    const comboOfferIds = cleanedComboItems.map((i: any) => i.comboOfferId);
    const comboOffers =
      comboOfferIds.length > 0
        ? await ComboOffer.find({ _id: { $in: comboOfferIds } }).populate("items.menuItem")
        : [];

    if (comboOffers.length !== comboOfferIds.length) {
      return NextResponse.json(
        { success: false, message: "Some combo offers are invalid" },
        { status: 400 }
      );
    }

    for (const combo of comboOffers as any[]) {
      if (!isComboActive(combo)) {
        return NextResponse.json(
          { success: false, message: `${combo.name} combo is not active` },
          { status: 400 }
        );
      }
    }

    const orderComboItems = cleanedComboItems.map((item: any) => {
      const combo = (comboOffers as any[]).find(
        (c) => c._id.toString() === item.comboOfferId
      );
      if (!combo) throw new Error("Invalid combo offer");

      combo.items.forEach((comboItem: any) => {
        orderItemsForStock.push({
          menuItemId: comboItem.menuItem._id.toString(),
          quantity: Number(comboItem.quantity || 0) * item.quantity,
        });
      });

      return {
        comboOffer: combo._id,
        quantity: item.quantity,
        price: Number(combo.offerPrice || 0),
        originalPrice: Number(combo.originalPrice || 0),
        comboItemsSnapshot: combo.items.map((ci: any) => ({
          menuItem: ci.menuItem._id,
          name: ci.menuItem.name,
          quantity: Number(ci.quantity || 0),
          priceSnapshot: Number(ci.priceSnapshot || 0),
        })),
      };
    });

    // Total Amount (Fixed with types)
    const normalTotal = orderItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    const comboTotal = orderComboItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    const totalAmount = normalTotal + comboTotal;

    // Validate Stock
    const stockCheck = await validateStockForItems(orderItemsForStock);
    if (!stockCheck.success) {
      return NextResponse.json(
        { success: false, message: stockCheck.message },
        { status: 400 }
      );
    }

    // Create Order
    const order = await Order.create({
      table: table._id,
      orderType: "TAKE_AWAY",
      customerName,
      customerPhone,
      items: orderItems,
      comboItems: orderComboItems,
      totalAmount,
      status: "PENDING",
      paymentType,
      paymentStatus: paymentType === "PAY_NOW" ? "PENDING" : "UNPAID",
    });

    // Deduct Stock (Fixed - convert ObjectId to string)
    await deductStockForOrder(orderItemsForStock, order._id.toString());

    // Update table
    table.status = "OCCUPIED";
    await table.save();

    await createAuditLog({
      action: "TAKEAWAY_ORDER_CREATED",
      module: "CASHIER",
      description: `Takeaway order created for Table ${table.name}`,
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
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Takeaway order error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create takeaway order" },
      { status: 500 }
    );
  }
}