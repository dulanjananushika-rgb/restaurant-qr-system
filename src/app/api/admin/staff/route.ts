import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා
import User from "@/models/User";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { createStaffSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const staff = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    return apiErrorResponse(error, "Staff list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { name, email, password, role, status } = await parseJsonBody(
      request,
      createStaffSchema
    );

    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "A staff member with this email already exists",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      status,
    });

    // ==================== IMPORTANT FIX ====================
    // Staff එකක් create කළාට පස්සේ list එක refresh කරනවා
    revalidatePath("/admin/staff");
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message: "Staff member created successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Staff creation failed");
  }
}
