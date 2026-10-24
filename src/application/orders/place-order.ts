import crypto from "crypto";
import mongoose, { type ClientSession, type Types } from "mongoose";

import {
  aggregateQuantities,
} from "@/domain/order/calculations";
import { resolveOrderSelection } from "@/application/orders/order-selection";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import DiningSession from "@/models/DiningSession";
import InventoryItem from "@/models/InventoryItem";
import Order from "@/models/Order";
import StockMovement from "@/models/StockMovement";
import Table from "@/models/Table";
import type { CreateOrderInput } from "@/validation/order";

type TableRecord = {
  _id: Types.ObjectId;
  name: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "INACTIVE";
};

type InventoryRecord = {
  _id: Types.ObjectId;
  name: string;
  unit: string;
  quantity: number;
};

export type PlaceOrderResult = {
  orderId: string;
  diningSessionId: string | null;
  editToken: string;
  totalAmount: number;
  paymentType: CreateOrderInput["paymentType"];
  paymentStatus: "PENDING" | "UNPAID";
  status: "PENDING";
  pickupNumber: string | null;
};

function objectId(value: Types.ObjectId): string {
  return value.toString();
}

async function getOrCreateDiningSession(
  tableId: Types.ObjectId,
  session: ClientSession
) {
  return DiningSession.findOneAndUpdate(
    { table: tableId, status: "OPEN" },
    {
      $setOnInsert: {
        table: tableId,
        status: "OPEN",
        paymentStatus: "UNPAID",
        openedAt: new Date(),
        closedAt: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );
}

export async function placeOrder(input: CreateOrderInput): Promise<PlaceOrderResult> {
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
    let table: TableRecord | null = null;

    if (input.orderType === "DINE_IN") {
      table = await Table.findById(input.tableId)
        .session(session)
        .lean<TableRecord>();

      if (!table) throw new ApiError(404, "Restaurant table not found.", "TABLE_NOT_FOUND");
      if (table.status === "INACTIVE") {
        throw new ApiError(409, "This restaurant table is currently inactive.", "TABLE_INACTIVE");
      }
    }

    const {
      orderItems,
      orderComboItems,
      totalAmount,
      requirements,
    } = await resolveOrderSelection(normalQuantities, comboQuantities, session);
    const now = new Date();

    const inventoryIds = Array.from(requirements.keys());
    const inventory = inventoryIds.length
      ? await InventoryItem.find({ _id: { $in: inventoryIds } })
          .session(session)
          .lean<InventoryRecord[]>()
      : [];
    const inventoryById = new Map(inventory.map((item) => [objectId(item._id), item]));

    for (const [inventoryId, required] of requirements) {
      const item = inventoryById.get(inventoryId);
      if (!item) throw new ApiError(409, "A required inventory item was not found.", "INVENTORY_NOT_FOUND");
      if (Number(item.quantity) < required) {
        throw new ApiError(
          409,
          `Not enough stock for ${item.name}. Required: ${required} ${item.unit}. Available: ${item.quantity} ${item.unit}.`,
          "INSUFFICIENT_STOCK"
        );
      }
    }

    if (requirements.size > 0) {
      const result = await InventoryItem.bulkWrite(
        Array.from(requirements, ([inventoryId, required]) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(inventoryId), quantity: { $gte: required } },
            update: { $inc: { quantity: -required } },
          },
        })),
        { session, ordered: true }
      );
      if (result.modifiedCount !== requirements.size) {
        throw new ApiError(
          409,
          "Stock changed while the order was being placed. Please try again.",
          "STOCK_CONFLICT"
        );
      }
    }

    const diningSession =
      table && input.orderType === "DINE_IN"
        ? await getOrCreateDiningSession(table._id, session)
        : null;

    if (table && !diningSession) {
      throw new ApiError(500, "Failed to create the dining session.", "SESSION_CREATE_FAILED");
    }

    const customerEditToken = crypto.randomBytes(32).toString("hex");
    const paymentStatus = input.paymentType === "PAY_NOW" ? "PENDING" : "UNPAID";
    const [order] = await Order.create(
      [
        {
          table: table?._id ?? null,
          diningSession: diningSession?._id ?? null,
          orderType: input.orderType,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: orderItems,
          comboItems: orderComboItems,
          totalAmount,
          status: "PENDING",
          paymentType: input.paymentType,
          paymentStatus,
          customerEditToken,
          statusHistory: [
            {
              fromStatus: "",
              toStatus: "PENDING",
              changedBy: null,
              changedByName: "Customer",
              changedByRole: "CUSTOMER",
              note: table
                ? `Customer placed a dine-in order for ${table.name}.`
                : "Customer placed a takeaway order.",
              changedAt: now,
            },
          ],
        },
      ],
      { session }
    );

    if (requirements.size > 0) {
      await StockMovement.insertMany(
        Array.from(requirements, ([inventoryId, required]) => {
          const item = inventoryById.get(inventoryId);
          if (!item) throw new ApiError(500, "Inventory snapshot is missing.", "INVENTORY_SNAPSHOT_MISSING");
          return {
            inventoryItem: item._id,
            type: "ORDER_DEDUCTION",
            quantity: -required,
            previousQuantity: Number(item.quantity),
            newQuantity: Number(item.quantity) - required,
            reason: `Stock deducted for ${input.orderType} customer order`,
            referenceType: "ORDER",
            referenceId: order._id,
          };
        }),
        { session }
      );
    }

    if (table) {
      await Table.updateOne(
        { _id: table._id },
        { $set: { status: "OCCUPIED" } },
        { session }
      );
    }

    await createAuditLog(
      {
        action: "ORDER_PLACED",
        module: "PUBLIC_ORDER",
        description: table
          ? `${input.orderType} order placed for ${table.name}. Total: Rs. ${totalAmount}.`
          : `${input.orderType} order placed. Total: Rs. ${totalAmount}.`,
        performedBy: "Customer",
        metadata: {
          orderId: order._id.toString(),
          diningSessionId: diningSession?._id.toString() ?? null,
          tableId: table?._id.toString() ?? null,
          tableName: table?.name ?? null,
          orderType: input.orderType,
          paymentType: input.paymentType,
          totalAmount,
        },
      },
      { session, failClosed: true }
    );

    return {
      orderId: order._id.toString(),
      diningSessionId: diningSession?._id.toString() ?? null,
      editToken: customerEditToken,
      totalAmount,
      paymentType: input.paymentType,
      paymentStatus,
      status: "PENDING",
      pickupNumber:
        input.orderType === "TAKE_AWAY"
          ? order._id.toString().slice(-6).toUpperCase()
          : null,
    };
  });
}
