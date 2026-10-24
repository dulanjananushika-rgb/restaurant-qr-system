import mongoose, { type ClientSession, type Types } from "mongoose";
import type { z } from "zod";

import type { ActiveAuthUser } from "@/domain/auth/types";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import { connectDB } from "@/lib/mongodb";
import ComboOffer from "@/models/ComboOffer";
import MenuItem from "@/models/MenuItem";
import type {
  createComboOfferSchema,
  updateComboOfferSchema,
} from "@/validation/admin";

type CreateComboInput = z.infer<typeof createComboOfferSchema>;
type UpdateComboInput = z.infer<typeof updateComboOfferSchema>;

type MenuItemPrice = {
  _id: Types.ObjectId;
  name: string;
  price: number;
};

type StoredComboItem = {
  menuItem: Types.ObjectId;
  quantity: number;
  priceSnapshot: number;
};

type StoredCombo = {
  _id: Types.ObjectId;
  name: string;
  description: string;
  image: string;
  items: StoredComboItem[];
  originalPrice: number;
  offerPrice: number;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${field} is invalid.`, "INVALID_DATE");
  }
  return date;
}

function validateDateRange(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(
      400,
      "End date must be the same as or later than the start date.",
      "INVALID_DATE_RANGE"
    );
  }
}

async function buildItems(
  items: CreateComboInput["items"],
  session: ClientSession
) {
  const menuItems = await MenuItem.find({
    _id: { $in: items.map((item) => item.menuItem) },
    available: true,
  })
    .select("_id name price")
    .session(session)
    .lean<MenuItemPrice[]>();

  if (menuItems.length !== items.length) {
    throw new ApiError(
      400,
      "Some selected menu items are invalid or unavailable.",
      "INVALID_COMBO_ITEMS"
    );
  }

  const itemById = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const comboItems: StoredComboItem[] = items.map((input) => {
    const menuItem = itemById.get(input.menuItem);
    if (!menuItem || !Number.isFinite(menuItem.price) || menuItem.price < 0) {
      throw new ApiError(
        400,
        `${menuItem?.name ?? "A selected menu item"} has an invalid price.`,
        "INVALID_MENU_PRICE"
      );
    }
    return {
      menuItem: menuItem._id,
      quantity: input.quantity,
      priceSnapshot: Number(menuItem.price.toFixed(2)),
    };
  });

  const originalPrice = Number(
    comboItems
      .reduce((total, item) => total + item.priceSnapshot * item.quantity, 0)
      .toFixed(2)
  );
  return { comboItems, originalPrice };
}

function validateOfferPrice(offerPrice: number, originalPrice: number) {
  const rounded = Number(offerPrice.toFixed(2));
  if (rounded > originalPrice) {
    throw new ApiError(
      400,
      "Offer price cannot be greater than the original price.",
      "INVALID_OFFER_PRICE"
    );
  }
  return rounded;
}

async function populatedCombo(id: Types.ObjectId | string, session: ClientSession) {
  return ComboOffer.findById(id)
    .populate("items.menuItem")
    .session(session)
    .lean();
}

export async function listComboOffers() {
  await connectDB();
  return ComboOffer.find()
    .sort({ createdAt: -1 })
    .populate("items.menuItem")
    .lean();
}

export async function createComboOffer(input: CreateComboInput, user: ActiveAuthUser) {
  await connectDB();
  return runInTransaction(async (session) => {
    const startDate = parseDate(input.startDate, "Start date");
    const endDate = parseDate(input.endDate, "End date");
    validateDateRange(startDate, endDate);
    const { comboItems, originalPrice } = await buildItems(input.items, session);
    const offerPrice = validateOfferPrice(input.offerPrice, originalPrice);

    const [combo] = await ComboOffer.create(
      [
        {
          name: input.name,
          description: input.description,
          image: input.image,
          items: comboItems,
          originalPrice,
          offerPrice,
          active: input.active,
          startDate,
          endDate,
        },
      ],
      { session }
    );

    await createAuditLog(
      {
        action: "COMBO_CREATED",
        module: "COMBO_OFFERS",
        description: `Combo offer "${input.name}" created. Original price: Rs. ${originalPrice}, Offer price: Rs. ${offerPrice}.`,
        performedBy: user.email,
        metadata: {
          comboOfferId: combo._id.toString(),
          name: input.name,
          originalPrice,
          offerPrice,
          active: input.active,
        },
      },
      { session, failClosed: true }
    );
    return populatedCombo(combo._id, session);
  });
}

export async function updateComboOffer(
  comboId: string,
  input: UpdateComboInput,
  user: ActiveAuthUser
) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(comboId)) {
    throw new ApiError(400, "Invalid combo offer ID.", "INVALID_COMBO_ID");
  }

  return runInTransaction(async (session) => {
    const current = await ComboOffer.findById(comboId)
      .session(session)
      .lean<StoredCombo>();
    if (!current) {
      throw new ApiError(404, "Combo offer not found.", "COMBO_NOT_FOUND");
    }

    const startDate =
      input.startDate === undefined
        ? current.startDate
        : parseDate(input.startDate, "Start date");
    const endDate =
      input.endDate === undefined
        ? current.endDate
        : parseDate(input.endDate, "End date");
    validateDateRange(startDate, endDate);

    const rebuilt = input.items ? await buildItems(input.items, session) : null;
    const items = rebuilt?.comboItems ?? current.items;
    const originalPrice = rebuilt?.originalPrice ?? current.originalPrice;
    const offerPrice = validateOfferPrice(
      input.offerPrice ?? current.offerPrice,
      originalPrice
    );

    const updated = await ComboOffer.findOneAndUpdate(
      { _id: comboId },
      {
        $set: {
          name: input.name ?? current.name,
          description: input.description ?? current.description,
          image: input.image ?? current.image,
          items,
          originalPrice,
          offerPrice,
          active: input.active ?? current.active,
          startDate,
          endDate,
        },
      },
      { new: true, runValidators: true, session }
    );
    if (!updated) {
      throw new ApiError(409, "Combo offer changed concurrently.", "CONCURRENT_UPDATE");
    }

    await createAuditLog(
      {
        action: "COMBO_UPDATED",
        module: "COMBO_OFFERS",
        description: `Combo offer "${updated.name}" updated. Original price: Rs. ${originalPrice}, Offer price: Rs. ${offerPrice}.`,
        performedBy: user.email,
        metadata: {
          comboOfferId: comboId,
          name: updated.name,
          originalPrice,
          offerPrice,
          active: updated.active,
        },
      },
      { session, failClosed: true }
    );
    return populatedCombo(comboId, session);
  });
}

export async function deleteComboOffer(comboId: string, user: ActiveAuthUser) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(comboId)) {
    throw new ApiError(400, "Invalid combo offer ID.", "INVALID_COMBO_ID");
  }

  return runInTransaction(async (session) => {
    const deleted = await ComboOffer.findOneAndDelete({ _id: comboId }, { session });
    if (!deleted) {
      throw new ApiError(404, "Combo offer not found.", "COMBO_NOT_FOUND");
    }
    await createAuditLog(
      {
        action: "COMBO_DELETED",
        module: "COMBO_OFFERS",
        description: `Combo offer "${deleted.name}" deleted.`,
        performedBy: user.email,
        metadata: {
          comboOfferId: deleted._id.toString(),
          name: deleted.name,
          originalPrice: deleted.originalPrice,
          offerPrice: deleted.offerPrice,
        },
      },
      { session, failClosed: true }
    );
  });
}
