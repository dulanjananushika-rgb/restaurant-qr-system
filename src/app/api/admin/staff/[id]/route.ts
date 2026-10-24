import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { updateStaffSchema } from "@/validation/admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { id } = await params;
    const { name, email, password, role, status } = await parseJsonBody(
      request,
      updateStaffSchema
    );

    if (id === auth.user.id && (role !== "ADMIN" || status !== "ACTIVE")) {
      throw new ApiError(
        400,
        "You cannot remove your own active administrator access.",
        "SELF_LOCKOUT_FORBIDDEN"
      );
    }

    const existingUser = await User.findOne({
      email,
      _id: { $ne: id },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Another staff member already uses this email",
        },
        { status: 400 }
      );
    }

    const updateData: {
      name: string;
      email: string;
      role: string;
      status: string;
      password?: string;
    } = {
      name,
      email,
      role,
      status,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff member not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return apiErrorResponse(error, "Staff update failed");
  }
}
