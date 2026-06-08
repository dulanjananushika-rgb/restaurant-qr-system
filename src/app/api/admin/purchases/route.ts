import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Purchase from "@/models/Purchase";
import Supplier from "@/models/Supplier";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

type PurchaseRequestItem = {
  inventoryItem: string;
  quantity: number;
  unitCost: number;
};

export async function GET() {
  try {
    await connectDB();

    const purchases = await Purchase.find()
      .sort({ createdAt: -1 })
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();

    return NextResponse.json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    console.error("Purchases GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load purchases",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

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
    } = body as {
      supplier: string;
      invoiceNumber?: string;
      purchaseDate?: string;
      items: PurchaseRequestItem[];
      paymentStatus?: "UNPAID" | "PAID" | "PARTIALLY_PAID";
      note?: string;
    };

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier is required",
        },
        { status: 400 }
      );
    }

    const supplierExists = await Supplier.findById(supplier);

    if (!supplierExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier not found",
        },
        { status: 404 }
      );
    }

    if (supplierExists.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Selected supplier is inactive",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one purchase item",
        },
        { status: 400 }
      );
    }

    if (!["UNPAID", "PAID", "PARTIALLY_PAID"].includes(paymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment status",
        },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .filter(
        (item) =>
          item.inventoryItem &&
          Number(item.quantity) > 0 &&
          Number(item.unitCost) >= 0
      )
      .map((item) => ({
        inventoryItem: item.inventoryItem,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add valid inventory items, quantities and costs",
        },
        { status: 400 }
      );
    }

    const inventoryIds = cleanedItems.map((item) => item.inventoryItem);

    const inventoryItems = await InventoryItem.find({
      _id: { $in: inventoryIds },
    });

    if (inventoryItems.length !== inventoryIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some inventory items are invalid",
        },
        { status: 400 }
      );
    }

    const purchaseItems = cleanedItems.map((item) => {
      const inventoryItem = inventoryItems.find(
        (inventory: any) => inventory._id.toString() === item.inventoryItem
      );

      if (!inventoryItem) {
        throw new Error("Invalid inventory item");
      }

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

    const stockMovements = [];

    for (const purchaseItem of purchaseItems) {
      const inventoryItem = inventoryItems.find(
        (inventory: any) =>
          inventory._id.toString() === purchaseItem.inventoryItem.toString()
      );

      if (!inventoryItem) {
        throw new Error("Inventory item not found while updating stock");
      }

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
        reason: `Stock purchased from ${supplierExists.name}. Invoice: ${
          invoiceNumber || "N/A"
        }`,
        referenceType: "SYSTEM",
        referenceId: purchase._id,
      });
    }

    if (stockMovements.length > 0) {
      await StockMovement.insertMany(stockMovements);
    }

    await createAuditLog({
      action: "PURCHASE_CREATED",
      module: "PURCHASES",
      description: `Purchase created from ${supplierExists.name}. Total: Rs. ${totalAmount}. Items: ${purchaseItems.length}.`,
    });

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: "Purchase created successfully",
        data: populatedPurchase,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Purchases POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create purchase",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}