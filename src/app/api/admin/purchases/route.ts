import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache"; // ← Import කළා

import Purchase from "@/models/Purchase";
import Supplier from "@/models/Supplier";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

type PurchaseRequestItem = {
  inventoryItem: string;
  quantity: number;
  unitCost: number;
};

// GET - All Purchases
export async function GET() {
  try {
    await connectDB();

    const purchases = await Purchase.find()
      .sort({ createdAt: -1 })
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();

    return NextResponse.json({ success: true, data: purchases });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to load purchases" },
      { status: 500 }
    );
  }
}

// POST - Create Purchase
export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      supplier,
      invoiceNumber = "",
      purchaseDate = "",
      items,
      paymentStatus = "UNPAID",
      note = "",
    } = body;

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "Supplier is required" },
        { status: 400 }
      );
    }

    const supplierExists = await Supplier.findById(supplier);
    if (!supplierExists) {
      return NextResponse.json(
        { success: false, message: "Supplier not found" },
        { status: 404 }
      );
    }

    if (supplierExists.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Selected supplier is inactive" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please add at least one purchase item" },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .filter(
        (item: any) =>
          item.inventoryItem &&
          Number(item.quantity) > 0 &&
          Number(item.unitCost) >= 0
      )
      .map((item: any) => ({
        inventoryItem: item.inventoryItem,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please add valid purchase items" },
        { status: 400 }
      );
    }

    const inventoryIds = cleanedItems.map((item) => item.inventoryItem);
    const inventoryItems = await InventoryItem.find({ _id: { $in: inventoryIds } });

    if (inventoryItems.length !== inventoryIds.length) {
      return NextResponse.json(
        { success: false, message: "Some inventory items are invalid" },
        { status: 400 }
      );
    }

    const purchaseItems = cleanedItems.map((item) => {
      const inventoryItem = inventoryItems.find(
        (inv: any) => inv._id.toString() === item.inventoryItem
      );
      if (!inventoryItem) throw new Error("Invalid inventory item");

      return {
        inventoryItem: inventoryItem._id,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.quantity * item.unitCost,
      };
    });

    const totalAmount = purchaseItems.reduce(
      (sum, item) => sum + item.totalCost,
      0
    );

    const purchase = await Purchase.create({
      supplier: supplierExists._id,
      invoiceNumber,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items: purchaseItems,
      totalAmount,
      paymentStatus,
      note,
    });

    // Update Stock + Create StockMovement
    const stockMovements = [];

    for (const purchaseItem of purchaseItems) {
      const inventoryItem = inventoryItems.find(
        (inv: any) => inv._id.toString() === purchaseItem.inventoryItem.toString()
      );
      if (!inventoryItem) continue;

      const previousQuantity = Number(inventoryItem.quantity);
      const newQuantity = previousQuantity + Number(purchaseItem.quantity);

      await InventoryItem.findByIdAndUpdate(inventoryItem._id, {
        quantity: newQuantity,
      });

      stockMovements.push({
        inventoryItem: inventoryItem._id,
        type: "STOCK_IN",
        quantity: Number(purchaseItem.quantity),
        previousQuantity,
        newQuantity,
        reason: `Stock purchased from ${supplierExists.name}`,
        referenceType: "PURCHASE",
        referenceId: purchase._id,
      });
    }

    if (stockMovements.length > 0) {
      await StockMovement.insertMany(stockMovements);
    }

    await createAuditLog({
      action: "PURCHASE_CREATED",
      module: "PURCHASES",
      description: `Purchase created from ${supplierExists.name}. Total: Rs. ${totalAmount}`,
    });

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/inventory");
    // =====================================================

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();

    return NextResponse.json({
      success: true,
      message: "Purchase created successfully",
      data: populatedPurchase,
    });
  } catch (error) {
    console.error("Purchases POST error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create purchase" },
      { status: 500 }
    );
  }
}

// PATCH - Update Payment Status
export async function PATCH(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { purchaseId, paymentStatus } = body;

    if (!purchaseId || !paymentStatus) {
      return NextResponse.json(
        { success: false, message: "Purchase ID and payment status are required" },
        { status: 400 }
      );
    }

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return NextResponse.json(
        { success: false, message: "Purchase not found" },
        { status: 404 }
      );
    }

    purchase.paymentStatus = paymentStatus;
    await purchase.save();

    await createAuditLog({
      action: "PURCHASE_PAYMENT_UPDATED",
      module: "PURCHASES",
      description: `Payment status changed to ${paymentStatus} for purchase #${purchase._id.toString().slice(-6)}`,
    });

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/purchases");
    // =====================================================

    const updatedPurchase = await Purchase.findById(purchaseId)
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();

    return NextResponse.json({
      success: true,
      message: "Payment status updated successfully",
      data: updatedPurchase,
    });
  } catch (error) {
    console.error("Purchase PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update payment status" },
      { status: 500 }
    );
  }
}