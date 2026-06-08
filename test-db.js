const mongoose = require("mongoose");

const uri =
  "mongodb://admin:QWE%40123qw@ac-h9196in-shard-00-00.nlmn1oo.mongodb.net:27017,ac-h9196in-shard-00-01.nlmn1oo.mongodb.net:27017,ac-h9196in-shard-00-02.nlmn1oo.mongodb.net:27017/restaurant_qr_system?ssl=true&replicaSet=atlas-teefmu-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  try {
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