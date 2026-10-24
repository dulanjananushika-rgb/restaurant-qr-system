const uri = process.env.MONGODB_URI;

async function test() {
  try {
    if (!uri) throw new Error("MONGODB_URI is required");
    const { default: mongoose } = await import("mongoose");
    console.log("Connecting...");
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected successfully");
    await mongoose.disconnect();
    console.log("Disconnected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error);
  }
}

test();
