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

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

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
  revalidatePath(
    "/admin/combo-offers"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath("/takeaway");

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
   UPDATE combo offer
========================= */

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    await connectDB();

    const { id } = await params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid combo offer ID.",
        },
        {
          status: 400,
        }
      );
    }

    const existingCombo =
      await ComboOffer.findById(id).lean();

    if (!existingCombo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Combo offer not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      (await request.json()) as ComboOfferRequestBody;

    /*
     * Support both full updates from the Admin
     * form and smaller partial updates.
     */
    const name =
      body.name === undefined
        ? String(
            (existingCombo as any).name ||
              ""
          )
        : sanitizeText(
            body.name,
            150
          );

    if (!name) {
      throw new RequestValidationError(
        "Combo name is required."
      );
    }

    const description =
      body.description === undefined
        ? String(
            (existingCombo as any)
              .description || ""
          )
        : sanitizeText(
            body.description,
            1500
          );

    const image =
      body.image === undefined
        ? String(
            (existingCombo as any).image ||
              ""
          )
        : sanitizeText(
            body.image,
            2000
          );

    const active =
      typeof body.active === "boolean"
        ? body.active
        : Boolean(
            (existingCombo as any).active
          );

    const startDate =
      body.startDate === undefined
        ? (existingCombo as any)
            .startDate
          ? new Date(
              (existingCombo as any)
                .startDate
            )
          : null
        : parseOptionalDate(
            body.startDate,
            "Start date"
          );

    const endDate =
      body.endDate === undefined
        ? (existingCombo as any).endDate
          ? new Date(
              (existingCombo as any)
                .endDate
            )
          : null
        : parseOptionalDate(
            body.endDate,
            "End date"
          );

    validateDateRange(
      startDate,
      endDate
    );

    let comboItems =
      (existingCombo as any).items;

    let originalPrice = Number(
      (existingCombo as any)
        .originalPrice || 0
    );

    /*
     * Recalculate item snapshots and original
     * price only when items were submitted.
     */
    if (body.items !== undefined) {
      const rebuiltItems =
        await buildComboItems(
          body.items
        );

      comboItems =
        rebuiltItems.comboItems;

      originalPrice =
        rebuiltItems.originalPrice;
    }

    const offerPrice =
      body.offerPrice === undefined
        ? Number(
            (existingCombo as any)
              .offerPrice || 0
          )
        : Number(body.offerPrice);

    if (
      !Number.isFinite(offerPrice) ||
      offerPrice <= 0
    ) {
      throw new RequestValidationError(
        "A valid offer price greater than zero is required."
      );
    }

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

    const updatedCombo =
      await ComboOffer.findByIdAndUpdate(
        id,
        {
          $set: {
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
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("items.menuItem")
        .lean();

    if (!updatedCombo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Combo offer not found.",
        },
        {
          status: 404,
        }
      );
    }

    await createAuditLog({
      action: "COMBO_UPDATED",
      module: "COMBO_OFFERS",

      description:
        `Combo offer "${name}" updated. ` +
        `Original price: Rs. ${originalPrice}, ` +
        `Offer price: Rs. ${roundedOfferPrice}.`,

      metadata: {
        comboOfferId: id,
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
          "Combo offer updated successfully.",
        data: updatedCombo,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Combo offer PATCH API error:",
      error
    );

    return createErrorResponse(
      error,
      "Failed to update combo offer."
    );
  }
}

/* =========================
   DELETE combo offer
========================= */

export async function DELETE(
  _request: Request,
  { params }: RouteParams
) {
  try {
    await connectDB();

    const { id } = await params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid combo offer ID.",
        },
        {
          status: 400,
        }
      );
    }

    const deletedCombo =
      await ComboOffer.findByIdAndDelete(
        id
      );

    if (!deletedCombo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Combo offer not found.",
        },
        {
          status: 404,
        }
      );
    }

    await createAuditLog({
      action: "COMBO_DELETED",
      module: "COMBO_OFFERS",

      description:
        `Combo offer "${deletedCombo.name}" deleted.`,

      metadata: {
        comboOfferId:
          deletedCombo._id.toString(),

        name: deletedCombo.name,
        originalPrice:
          deletedCombo.originalPrice,
        offerPrice:
          deletedCombo.offerPrice,
      },
    });

    revalidateComboPages();

    return NextResponse.json(
      {
        success: true,
        message:
          "Combo offer deleted successfully.",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Combo offer DELETE API error:",
      error
    );

    return createErrorResponse(
      error,
      "Failed to delete combo offer."
    );
  }
}