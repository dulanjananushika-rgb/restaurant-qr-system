import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import ComboOffer from "@/models/ComboOffer";
import MenuItem from "@/models/MenuItem";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type ComboItemInput = {
  menuItem?: string;
  quantity?: number | string;
};

type ComboOfferRequestBody = {
  name?: string;
  description?: string;
  image?: string;
  items?: ComboItemInput[];
  offerPrice?: number | string;
  active?: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

type CleanedComboItem = {
  menuItem: string;
  quantity: number;
};

class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

/* =========================
   Helper functions
========================= */

function sanitizeText(
  value: unknown,
  maximumLength: number
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function parseOptionalDate(
  value: unknown,
  fieldName: string
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsedDate = new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    throw new RequestValidationError(
      `${fieldName} is invalid.`
    );
  }

  return parsedDate;
}

function validateDateRange(
  startDate: Date | null,
  endDate: Date | null
) {
  if (
    startDate &&
    endDate &&
    endDate.getTime() < startDate.getTime()
  ) {
    throw new RequestValidationError(
      "End date must be the same as or later than the start date."
    );
  }
}

function normalizeComboItems(
  items: unknown
): CleanedComboItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new RequestValidationError(
      "Please add at least one menu item to the combo."
    );
  }

  const cleanedItems: CleanedComboItem[] = [];
  const duplicateCheck = new Set<string>();

  for (const rawItem of items as ComboItemInput[]) {
    const menuItemId =
      typeof rawItem?.menuItem === "string"
        ? rawItem.menuItem.trim()
        : "";

    const quantity = Number(rawItem?.quantity);

    if (
      !menuItemId ||
      !mongoose.Types.ObjectId.isValid(menuItemId)
    ) {
      throw new RequestValidationError(
        "One or more menu item IDs are invalid."
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new RequestValidationError(
        "Every combo item must have a valid quantity greater than zero."
      );
    }

    if (duplicateCheck.has(menuItemId)) {
      throw new RequestValidationError(
        "Duplicate menu items are not allowed in one combo."
      );
    }

    duplicateCheck.add(menuItemId);

    cleanedItems.push({
      menuItem: menuItemId,
      quantity,
    });
  }

  return cleanedItems;
}

async function buildComboItems(
  rawItems: unknown
) {
  const cleanedItems =
    normalizeComboItems(rawItems);

  const menuItemIds = cleanedItems.map(
    (item) => item.menuItem
  );

  /*
   * Only currently available menu items can
   * be included in a new combo offer.
   */
  const menuItems = (await MenuItem.find({
    _id: {
      $in: menuItemIds,
    },

    available: true,
  })
    .select("_id name price available")
    .lean()) as any[];

  if (menuItems.length !== menuItemIds.length) {
    throw new RequestValidationError(
      "Some selected menu items are invalid or unavailable."
    );
  }

  const menuItemMap = new Map(
    menuItems.map((menuItem: any) => [
      menuItem._id.toString(),
      menuItem,
    ])
  );

  const comboItems = cleanedItems.map(
    (item) => {
      const menuItem = menuItemMap.get(
        item.menuItem
      );

      if (!menuItem) {
        throw new RequestValidationError(
          "A selected menu item could not be found."
        );
      }

      const itemPrice = Number(
        menuItem.price
      );

      if (
        !Number.isFinite(itemPrice) ||
        itemPrice < 0
      ) {
        throw new RequestValidationError(
          `${menuItem.name || "A menu item"} has an invalid price.`
        );
      }

      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        priceSnapshot: itemPrice,
      };
    }
  );

  const originalPrice = Number(
    comboItems
      .reduce(
        (total, item) =>
          total +
          item.priceSnapshot *
            item.quantity,
        0
      )
      .toFixed(2)
  );

  return {
    comboItems,
    originalPrice,
  };
}

function revalidateComboPages() {
  /*
   * Admin combo list.
   */
  revalidatePath(
    "/admin/combo-offers"
  );

  /*
   * Admin dashboard may contain recent
   * information or statistics.
   */
  revalidatePath(
    "/admin/dashboard"
  );

  /*
   * Public customer takeaway page.
   */
  revalidatePath("/takeaway");

  /*
   * Revalidate every table-specific
   * customer ordering page.
   */
  revalidatePath(
    "/table/[qrCode]",
    "page"
  );
}

function createErrorResponse(
  error: unknown,
  defaultMessage: string
) {
  if (
    error instanceof RequestValidationError
  ) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 400,
      }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The request body contains invalid JSON.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    error instanceof
    mongoose.Error.ValidationError
  ) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: defaultMessage,

      error:
        process.env.NODE_ENV ===
        "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    },
    {
      status: 500,
    }
  );
}

/* =========================
   GET all combo offers
========================= */

export async function GET() {
  try {
    await connectDB();

    const comboOffers =
      await ComboOffer.find()
        .sort({
          createdAt: -1,
        })
        .populate("items.menuItem")
        .lean();

    return NextResponse.json(
      {
        success: true,
        data: comboOffers,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Combo offers GET API error:",
      error
    );

    return createErrorResponse(
      error,
      "Failed to load combo offers."
    );
  }
}

/* =========================
   CREATE combo offer
========================= */

export async function POST(
  request: Request
) {
  try {
    await connectDB();

    const body =
      (await request.json()) as ComboOfferRequestBody;

    const name = sanitizeText(
      body.name,
      150
    );

    const description = sanitizeText(
      body.description,
      1500
    );

    const image = sanitizeText(
      body.image,
      2000
    );

    if (!name) {
      throw new RequestValidationError(
        "Combo name is required."
      );
    }

    const offerPrice = Number(
      body.offerPrice
    );

    if (
      !Number.isFinite(offerPrice) ||
      offerPrice <= 0
    ) {
      throw new RequestValidationError(
        "A valid offer price greater than zero is required."
      );
    }

    const startDate =
      parseOptionalDate(
        body.startDate,
        "Start date"
      );

    const endDate =
      parseOptionalDate(
        body.endDate,
        "End date"
      );

    validateDateRange(
      startDate,
      endDate
    );

    const {
      comboItems,
      originalPrice,
    } = await buildComboItems(
      body.items
    );

    const roundedOfferPrice =
      Number(offerPrice.toFixed(2));

    if (
      roundedOfferPrice >
      originalPrice
    ) {
      throw new RequestValidationError(
        "Offer price cannot be greater than the original price."
      );
    }

    const active =
      typeof body.active === "boolean"
        ? body.active
        : true;

    const comboOffer =
      await ComboOffer.create({
        name,
        description,
        image,

        items: comboItems,

        originalPrice,
        offerPrice:
          roundedOfferPrice,

        active,

        startDate,
        endDate,
      });

    const populatedCombo =
      await ComboOffer.findById(
        comboOffer._id
      )
        .populate("items.menuItem")
        .lean();

    await createAuditLog({
      action: "COMBO_CREATED",
      module: "COMBO_OFFERS",

      description:
        `Combo offer "${name}" created. ` +
        `Original price: Rs. ${originalPrice}, ` +
        `Offer price: Rs. ${roundedOfferPrice}.`,

      metadata: {
        comboOfferId:
          comboOffer._id.toString(),

        name,
        originalPrice,
        offerPrice:
          roundedOfferPrice,
        active,
      },
    });

    revalidateComboPages();

    return NextResponse.json(
      {
        success: true,
        message:
          "Combo offer created successfully.",
        data: populatedCombo,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Combo offers POST API error:",
      error
    );

    return createErrorResponse(
      error,
      "Failed to create combo offer."
    );
  }
}