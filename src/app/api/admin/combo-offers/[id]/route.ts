import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import ComboOffer from "@/models/ComboOffer";
import MenuItem from "@/models/MenuItem";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type ComboItemInput = {
  menuItem: string;
  quantity: number;
};

function isValidDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return true;

  const start = new Date(startDate);
  const end = new Date(endDate);

  return end >= start;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description = "",
      image = "",
      items,
      offerPrice,
      active = true,
      startDate = "",
      endDate = "",
    } = body as {
      name: string;
      description?: string;
      image?: string;
      items: ComboItemInput[];
      offerPrice: number;
      active?: boolean;
      startDate?: string;
      endDate?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Combo name is required",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one menu item to combo",
        },
        { status: 400 }
      );
    }

    if (!offerPrice || Number(offerPrice) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid offer price is required",
        },
        { status: 400 }
      );
    }

    if (!isValidDateRange(startDate, endDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "End date must be after start date",
        },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .filter((item) => item.menuItem && Number(item.quantity) > 0)
      .map((item) => ({
        menuItem: item.menuItem,
        quantity: Number(item.quantity),
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add valid menu items and quantities",
        },
        { status: 400 }
      );
    }

    const duplicateCheck = new Set<string>();

    for (const item of cleanedItems) {
      if (duplicateCheck.has(item.menuItem)) {
        return NextResponse.json(
          {
            success: false,
            message: "Duplicate menu items are not allowed in one combo",
          },
          { status: 400 }
        );
      }

      duplicateCheck.add(item.menuItem);
    }

    const menuItemIds = cleanedItems.map((item) => item.menuItem);

    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      available: true,
    }).lean();

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some menu items are invalid or unavailable",
        },
        { status: 400 }
      );
    }

    const comboItems = cleanedItems.map((item) => {
      const menuItem = menuItems.find(
        (menu) => menu._id.toString() === item.menuItem
      );

      if (!menuItem) {
        throw new Error("Invalid menu item in combo");
      }

      return {
        menuItem: menuItem._id,
        quantity: item.quantity,
        priceSnapshot: Number(menuItem.price),
      };
    });

    const originalPrice = comboItems.reduce(
      (sum, item) => sum + item.priceSnapshot * item.quantity,
      0
    );

    if (Number(offerPrice) > originalPrice) {
      return NextResponse.json(
        {
          success: false,
          message: "Offer price cannot be greater than original price",
        },
        { status: 400 }
      );
    }

    const updatedCombo = await ComboOffer.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        description,
        image,
        items: comboItems,
        originalPrice,
        offerPrice: Number(offerPrice),
        active,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      { new: true }
    )
      .populate("items.menuItem")
      .lean();

    if (!updatedCombo) {
      return NextResponse.json(
        {
          success: false,
          message: "Combo offer not found",
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: "COMBO_UPDATED",
      module: "COMBO_OFFERS",
      description: `Combo offer "${name.trim()}" updated. Original price: Rs. ${originalPrice}, Offer price: Rs. ${Number(
        offerPrice
      )}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Combo offer updated successfully",
      data: updatedCombo,
    });
  } catch (error) {
    console.error("Combo offer PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update combo offer",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;

    const deletedCombo = await ComboOffer.findByIdAndDelete(id);

    if (!deletedCombo) {
      return NextResponse.json(
        {
          success: false,
          message: "Combo offer not found",
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: "COMBO_DELETED",
      module: "COMBO_OFFERS",
      description: `Combo offer "${deletedCombo.name}" deleted.`,
    });

    return NextResponse.json({
      success: true,
      message: "Combo offer deleted successfully",
    });
  } catch (error) {
    console.error("Combo offer DELETE API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete combo offer",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}