import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import MenuItem from "@/models/MenuItem";

import {
  validateStockForItems,
  restoreStockForOrder,
  deductStockForOrder,
} from "@/lib/inventory";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateOrderItem = {
  menuItemId: string;
  quantity: number;
};

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
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to load order" },
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
      cancel,
    } = body as {
      editToken?: string;
      customerName?: string;
      customerPhone?: string;
      items?: UpdateOrderItem[];
      cancel?: boolean;
    };

    if (!editToken) {
      return NextResponse.json(
        { success: false, message: "Edit token is required" },
        { status: 401 }
      );
    }

    const order = await Order.findById(id).select("+customerEditToken");
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    const orderDoc = order as any;

    if (orderDoc.customerEditToken !== editToken) {
      return NextResponse.json(
        { success: false, message: "You are not allowed to edit this order" },
        { status: 403 }
      );
    }

    // ==================== CANCEL ORDER ====================
    if (cancel === true) {
      if (orderDoc.status !== "PENDING") {
        return NextResponse.json(
          { success: false, message: "You can only cancel pending orders" },
          { status: 400 }
        );
      }

      // Restore stock
      const oldItems = (orderDoc.items || []).map((item: any) => ({
        menuItemId: item.menuItem.toString(),
        quantity: Number(item.quantity || 0),
      }));

      if (oldItems.length > 0) {
        await restoreStockForOrder(oldItems, orderDoc._id);
      }

      orderDoc.status = "CANCELLED";
      orderDoc.statusHistory.push({
        fromStatus: "PENDING",
        toStatus: "CANCELLED",
        changedByName: "Customer",
        changedByRole: "CUSTOMER",
        note: "Order cancelled by customer",
        changedAt: new Date(),
      });

      await orderDoc.save();

      await createAuditLog({
        action: "ORDER_CANCELLED",
        module: "PUBLIC_ORDER",
        description: `Order #${orderDoc._id.toString().slice(-6)} cancelled by customer`,
        performedBy: "Customer",
      });

      return NextResponse.json({
        success: true,
        message: "Order cancelled successfully",
        data: orderDoc,
      });
    }

    // ==================== EDIT ORDER ====================
    if (orderDoc.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message: "Kitchen has already accepted this order. Please place a new order for extra items.",
        },
        { status: 400 }
      );
    }

    if (orderDoc.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          success: false,
          message: "This order is already paid. Please place a new order for extra items.",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please add at least one item" },
        { status: 400 }
      );
    }

    const cleanedItems: UpdateOrderItem[] = items
      .filter((item) => item.menuItemId && Number(item.quantity) > 0)
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please add valid order items" },
        { status: 400 }
      );
    }

    // Get old items for rollback
    const oldItems: UpdateOrderItem[] = (orderDoc.items || []).map((item: any) => ({
      menuItemId: item.menuItem.toString(),
      quantity: Number(item.quantity || 0),
    }));

    // Step 1: Restore old stock
    if (oldItems.length > 0) {
      await restoreStockForOrder(oldItems, orderDoc._id);
    }

    // Step 2: Validate new stock
    const stockCheck = await validateStockForItems(cleanedItems);

    if (!stockCheck.success) {
      if (oldItems.length > 0) {
        await deductStockForOrder(oldItems, orderDoc._id);
      }
      return NextResponse.json(
        { success: false, message: stockCheck.message },
        { status: 400 }
      );
    }

    // Step 3: Deduct new stock
    await deductStockForOrder(cleanedItems, orderDoc._id);

    // Step 4: Update order items
    const menuItems = await MenuItem.find({
      _id: { $in: cleanedItems.map((i) => i.menuItemId) },
      available: true,
    });

    const updatedItems = cleanedItems.map((item) => {
      const menu = menuItems.find((m: any) => m._id.toString() === item.menuItemId);
      if (!menu) throw new Error("Invalid menu item");

      return {
        menuItem: menu._id,
        quantity: item.quantity,
        price: Number(menu.price || 0),
      };
    });

    const totalAmount = updatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    orderDoc.customerName = customerName;
    orderDoc.customerPhone = customerPhone;
    orderDoc.items = updatedItems;
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
      .lean();

    await createAuditLog({
      action: "CUSTOMER_ORDER_EDITED",
      module: "PUBLIC_ORDER",
      description: `Customer edited Order #${orderDoc._id.toString().slice(-6).toUpperCase()}`,
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
      { success: false, message: "Failed to update order" },
      { status: 500 }
    );
  }
}