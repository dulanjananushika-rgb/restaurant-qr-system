import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";

import User from "@/models/User";
import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import Table from "@/models/Table";
import InventoryItem from "@/models/InventoryItem";
import RecipeItem from "@/models/RecipeItem";
import ComboOffer from "@/models/ComboOffer";
import Order from "@/models/Order";

export async function POST() {
  try {
    await connectDB();

    // Clear demo data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      InventoryItem.deleteMany({}),
      RecipeItem.deleteMany({}),
      ComboOffer.deleteMany({}),
      Order.deleteMany({}),
    ]);

    // Users / Staff
    const hashedPassword = await bcrypt.hash("123456", 10);

    const users = await User.insertMany([
      {
        name: "System Admin",
        email: "admin@saffron.com",
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
      },
      {
        name: "Kitchen Staff",
        email: "kitchen@saffron.com",
        password: hashedPassword,
        role: "KITCHEN_STAFF",
        status: "ACTIVE",
      },
      {
        name: "Waiter Staff",
        email: "waiter@saffron.com",
        password: hashedPassword,
        role: "WAITER",
        status: "ACTIVE",
      },
      {
        name: "Cashier Staff",
        email: "cashier@saffron.com",
        password: hashedPassword,
        role: "CASHIER",
        status: "ACTIVE",
      },
    ]);

    // Categories
    const categories = await Category.insertMany([
      {
        name: "Rice",
        description: "Fresh rice dishes and fried rice meals",
      },
      {
        name: "Kottu",
        description: "Sri Lankan kottu dishes",
      },
      {
        name: "Burgers",
        description: "Burger meals and snacks",
      },
      {
        name: "Drinks",
        description: "Cold drinks and fresh juices",
      },
      {
        name: "Desserts",
        description: "Sweet desserts and treats",
      },
    ]);

    const riceCategory = categories.find((item) => item.name === "Rice");
    const kottuCategory = categories.find((item) => item.name === "Kottu");
    const burgerCategory = categories.find((item) => item.name === "Burgers");
    const drinksCategory = categories.find((item) => item.name === "Drinks");
    const dessertsCategory = categories.find((item) => item.name === "Desserts");

    // Menu Items
    const menuItems = await MenuItem.insertMany([
      {
        name: "Chicken Fried Rice",
        price: 1200,
        category: riceCategory?._id,
        image:
          "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80",
        description: "Fried rice with chicken, egg and vegetables.",
        available: true,
      },
      {
        name: "Seafood Fried Rice",
        price: 1550,
        category: riceCategory?._id,
        image:
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
        description: "Fried rice with prawns, fish and fresh vegetables.",
        available: true,
      },
      {
        name: "Chicken Kottu",
        price: 1300,
        category: kottuCategory?._id,
        image:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",
        description: "Sri Lankan style chicken kottu with spicy gravy.",
        available: true,
      },
      {
        name: "Cheese Kottu",
        price: 1450,
        category: kottuCategory?._id,
        image:
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80",
        description: "Creamy cheese kottu with chicken and egg.",
        available: true,
      },
      {
        name: "Classic Chicken Burger",
        price: 1100,
        category: burgerCategory?._id,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
        description: "Grilled chicken burger with lettuce and special sauce.",
        available: true,
      },
      {
        name: "French Fries",
        price: 650,
        category: burgerCategory?._id,
        image:
          "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80",
        description: "Crispy golden potato fries.",
        available: true,
      },
      {
        name: "Lime Juice",
        price: 350,
        category: drinksCategory?._id,
        image:
          "https://images.unsplash.com/photo-1523371054106-bbf80586c38c?auto=format&fit=crop&w=900&q=80",
        description: "Fresh lime juice with sugar and ice.",
        available: true,
      },
      {
        name: "Chocolate Milkshake",
        price: 750,
        category: drinksCategory?._id,
        image:
          "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=80",
        description: "Cold chocolate milkshake with whipped cream.",
        available: true,
      },
      {
        name: "Ice Cream Sundae",
        price: 800,
        category: dessertsCategory?._id,
        image:
          "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
        description: "Vanilla ice cream with chocolate topping.",
        available: true,
      },
    ]);

    function findMenuItem(name: string) {
      const item = menuItems.find((menu) => menu.name === name);

      if (!item) {
        throw new Error(`${name} menu item not found`);
      }

      return item;
    }

    // Tables
    const tables = await Table.insertMany([
      {
        name: "Table 01",
        capacity: 2,
        qrCode: "TABLE_01_QR",
        status: "AVAILABLE",
      },
      {
        name: "Table 02",
        capacity: 4,
        qrCode: "TABLE_02_QR",
        status: "AVAILABLE",
      },
      {
        name: "Table 03",
        capacity: 4,
        qrCode: "TABLE_03_QR",
        status: "OCCUPIED",
      },
      {
        name: "Table 04",
        capacity: 6,
        qrCode: "TABLE_04_QR",
        status: "AVAILABLE",
      },
      {
        name: "Table 05",
        capacity: 8,
        qrCode: "TABLE_05_QR",
        status: "AVAILABLE",
      },
    ]);

    // Inventory / Ingredients
    const inventoryItems = await InventoryItem.insertMany([
      {
        name: "Rice",
        unit: "g",
        quantity: 10000,
        minQuantity: 1000,
      },
      {
        name: "Chicken",
        unit: "g",
        quantity: 5000,
        minQuantity: 500,
      },
      {
        name: "Seafood Mix",
        unit: "g",
        quantity: 3000,
        minQuantity: 400,
      },
      {
        name: "Egg",
        unit: "pcs",
        quantity: 60,
        minQuantity: 10,
      },
      {
        name: "Vegetables",
        unit: "g",
        quantity: 7000,
        minQuantity: 800,
      },
      {
        name: "Oil",
        unit: "ml",
        quantity: 3000,
        minQuantity: 500,
      },
      {
        name: "Parotta",
        unit: "pcs",
        quantity: 80,
        minQuantity: 10,
      },
      {
        name: "Cheese",
        unit: "g",
        quantity: 1800,
        minQuantity: 300,
      },
      {
        name: "Burger Bun",
        unit: "pcs",
        quantity: 35,
        minQuantity: 8,
      },
      {
        name: "Potato",
        unit: "g",
        quantity: 6000,
        minQuantity: 700,
      },
      {
        name: "Lime",
        unit: "pcs",
        quantity: 40,
        minQuantity: 10,
      },
      {
        name: "Sugar",
        unit: "g",
        quantity: 4000,
        minQuantity: 500,
      },
      {
        name: "Milk",
        unit: "ml",
        quantity: 2500,
        minQuantity: 500,
      },
      {
        name: "Ice Cream",
        unit: "g",
        quantity: 2500,
        minQuantity: 400,
      },
      {
        name: "Chocolate Syrup",
        unit: "ml",
        quantity: 1500,
        minQuantity: 250,
      },
    ]);

    function findInventory(name: string) {
      const item = inventoryItems.find((inventory) => inventory.name === name);

      if (!item) {
        throw new Error(`${name} inventory item not found`);
      }

      return item;
    }

    // Recipes
    await RecipeItem.insertMany([
      // Chicken Fried Rice
      {
        menuItem: findMenuItem("Chicken Fried Rice")._id,
        inventoryItem: findInventory("Rice")._id,
        requiredQuantity: 250,
      },
      {
        menuItem: findMenuItem("Chicken Fried Rice")._id,
        inventoryItem: findInventory("Chicken")._id,
        requiredQuantity: 120,
      },
      {
        menuItem: findMenuItem("Chicken Fried Rice")._id,
        inventoryItem: findInventory("Egg")._id,
        requiredQuantity: 1,
      },
      {
        menuItem: findMenuItem("Chicken Fried Rice")._id,
        inventoryItem: findInventory("Vegetables")._id,
        requiredQuantity: 80,
      },
      {
        menuItem: findMenuItem("Chicken Fried Rice")._id,
        inventoryItem: findInventory("Oil")._id,
        requiredQuantity: 20,
      },

      // Seafood Fried Rice
      {
        menuItem: findMenuItem("Seafood Fried Rice")._id,
        inventoryItem: findInventory("Rice")._id,
        requiredQuantity: 250,
      },
      {
        menuItem: findMenuItem("Seafood Fried Rice")._id,
        inventoryItem: findInventory("Seafood Mix")._id,
        requiredQuantity: 150,
      },
      {
        menuItem: findMenuItem("Seafood Fried Rice")._id,
        inventoryItem: findInventory("Egg")._id,
        requiredQuantity: 1,
      },
      {
        menuItem: findMenuItem("Seafood Fried Rice")._id,
        inventoryItem: findInventory("Vegetables")._id,
        requiredQuantity: 80,
      },

      // Chicken Kottu
      {
        menuItem: findMenuItem("Chicken Kottu")._id,
        inventoryItem: findInventory("Parotta")._id,
        requiredQuantity: 2,
      },
      {
        menuItem: findMenuItem("Chicken Kottu")._id,
        inventoryItem: findInventory("Chicken")._id,
        requiredQuantity: 120,
      },
      {
        menuItem: findMenuItem("Chicken Kottu")._id,
        inventoryItem: findInventory("Egg")._id,
        requiredQuantity: 1,
      },
      {
        menuItem: findMenuItem("Chicken Kottu")._id,
        inventoryItem: findInventory("Vegetables")._id,
        requiredQuantity: 100,
      },

      // Cheese Kottu
      {
        menuItem: findMenuItem("Cheese Kottu")._id,
        inventoryItem: findInventory("Parotta")._id,
        requiredQuantity: 2,
      },
      {
        menuItem: findMenuItem("Cheese Kottu")._id,
        inventoryItem: findInventory("Chicken")._id,
        requiredQuantity: 100,
      },
      {
        menuItem: findMenuItem("Cheese Kottu")._id,
        inventoryItem: findInventory("Cheese")._id,
        requiredQuantity: 80,
      },
      {
        menuItem: findMenuItem("Cheese Kottu")._id,
        inventoryItem: findInventory("Egg")._id,
        requiredQuantity: 1,
      },

      // Classic Chicken Burger
      {
        menuItem: findMenuItem("Classic Chicken Burger")._id,
        inventoryItem: findInventory("Burger Bun")._id,
        requiredQuantity: 1,
      },
      {
        menuItem: findMenuItem("Classic Chicken Burger")._id,
        inventoryItem: findInventory("Chicken")._id,
        requiredQuantity: 150,
      },
      {
        menuItem: findMenuItem("Classic Chicken Burger")._id,
        inventoryItem: findInventory("Vegetables")._id,
        requiredQuantity: 40,
      },

      // French Fries
      {
        menuItem: findMenuItem("French Fries")._id,
        inventoryItem: findInventory("Potato")._id,
        requiredQuantity: 200,
      },
      {
        menuItem: findMenuItem("French Fries")._id,
        inventoryItem: findInventory("Oil")._id,
        requiredQuantity: 25,
      },

      // Lime Juice
      {
        menuItem: findMenuItem("Lime Juice")._id,
        inventoryItem: findInventory("Lime")._id,
        requiredQuantity: 2,
      },
      {
        menuItem: findMenuItem("Lime Juice")._id,
        inventoryItem: findInventory("Sugar")._id,
        requiredQuantity: 30,
      },

      // Chocolate Milkshake
      {
        menuItem: findMenuItem("Chocolate Milkshake")._id,
        inventoryItem: findInventory("Milk")._id,
        requiredQuantity: 250,
      },
      {
        menuItem: findMenuItem("Chocolate Milkshake")._id,
        inventoryItem: findInventory("Ice Cream")._id,
        requiredQuantity: 120,
      },
      {
        menuItem: findMenuItem("Chocolate Milkshake")._id,
        inventoryItem: findInventory("Chocolate Syrup")._id,
        requiredQuantity: 40,
      },

      // Ice Cream Sundae
      {
        menuItem: findMenuItem("Ice Cream Sundae")._id,
        inventoryItem: findInventory("Ice Cream")._id,
        requiredQuantity: 180,
      },
      {
        menuItem: findMenuItem("Ice Cream Sundae")._id,
        inventoryItem: findInventory("Chocolate Syrup")._id,
        requiredQuantity: 30,
      },
    ]);

    // Combo Offers
    await ComboOffer.insertMany([
      {
        name: "Rice Lovers Combo",
        description: "2 Chicken Fried Rice with 2 Lime Juice drinks.",
        image:
          "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=900&q=80",
        items: [
          {
            menuItem: findMenuItem("Chicken Fried Rice")._id,
            quantity: 2,
            priceSnapshot: findMenuItem("Chicken Fried Rice").price,
          },
          {
            menuItem: findMenuItem("Lime Juice")._id,
            quantity: 2,
            priceSnapshot: findMenuItem("Lime Juice").price,
          },
        ],
        originalPrice:
          findMenuItem("Chicken Fried Rice").price * 2 +
          findMenuItem("Lime Juice").price * 2,
        offerPrice: 2850,
        active: true,
        startDate: null,
        endDate: null,
      },
      {
        name: "Burger Snack Combo",
        description: "Classic Chicken Burger with French Fries and Milkshake.",
        image:
          "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80",
        items: [
          {
            menuItem: findMenuItem("Classic Chicken Burger")._id,
            quantity: 1,
            priceSnapshot: findMenuItem("Classic Chicken Burger").price,
          },
          {
            menuItem: findMenuItem("French Fries")._id,
            quantity: 1,
            priceSnapshot: findMenuItem("French Fries").price,
          },
          {
            menuItem: findMenuItem("Chocolate Milkshake")._id,
            quantity: 1,
            priceSnapshot: findMenuItem("Chocolate Milkshake").price,
          },
        ],
        originalPrice:
          findMenuItem("Classic Chicken Burger").price +
          findMenuItem("French Fries").price +
          findMenuItem("Chocolate Milkshake").price,
        offerPrice: 2200,
        active: true,
        startDate: null,
        endDate: null,
      },
    ]);

    // Sample Orders for dashboard/reports
    await Order.insertMany([
      {
        table: tables[2]._id,
        orderType: "DINE_IN",
        customerName: "Demo Customer",
        customerPhone: "0712345678",
        items: [
          {
            menuItem: findMenuItem("Chicken Fried Rice")._id,
            quantity: 1,
            price: findMenuItem("Chicken Fried Rice").price,
          },
          {
            menuItem: findMenuItem("Lime Juice")._id,
            quantity: 1,
            price: findMenuItem("Lime Juice").price,
          },
        ],
        comboItems: [],
        totalAmount:
          findMenuItem("Chicken Fried Rice").price +
          findMenuItem("Lime Juice").price,
        status: "PENDING",
        paymentType: "PAY_LATER",
        paymentStatus: "UNPAID",
      },
      {
        table: tables[1]._id,
        orderType: "DINE_IN",
        customerName: "Paid Customer",
        customerPhone: "0771234567",
        items: [
          {
            menuItem: findMenuItem("Chicken Kottu")._id,
            quantity: 2,
            price: findMenuItem("Chicken Kottu").price,
          },
        ],
        comboItems: [],
        totalAmount: findMenuItem("Chicken Kottu").price * 2,
        status: "DELIVERED",
        paymentType: "PAY_NOW",
        paymentStatus: "PAID",
      },
    ]);

    return NextResponse.json({
      success: true,
      message: "Sample data seeded successfully",
      data: {
        users: users.length,
        categories: categories.length,
        menuItems: menuItems.length,
        tables: tables.length,
        inventoryItems: inventoryItems.length,
        combos: 2,
        sampleOrders: 2,
        loginCredentials: {
          admin: "admin@saffron.com / 123456",
          kitchen: "kitchen@saffron.com / 123456",
          waiter: "waiter@saffron.com / 123456",
          cashier: "cashier@saffron.com / 123456",
        },
      },
    });
  } catch (error) {
    console.error("Seed API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to seed sample data",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}