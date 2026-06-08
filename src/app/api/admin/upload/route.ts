import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Cloudinary environment variables are missing",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Image file is required" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Only JPG, PNG and WEBP images are allowed" },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: "Image size must be less than 5MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadedImage = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "restaurant-qr/menu-items",
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(new Error("Cloudinary did not return upload result"));
              return;
            }

            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          }
        )
        .end(buffer);
    });

    return NextResponse.json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl: uploadedImage.secure_url,
        publicId: uploadedImage.public_id,
      },
    });
  } catch (error) {
    console.error("Image upload error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 }
    );
  }
}