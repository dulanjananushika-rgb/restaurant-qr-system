import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";

import Table from "@/models/Table";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import ComboOffer from "@/models/ComboOffer";

import CustomerMenuClient from "@/components/customer/CustomerMenuClient";

type PageParams = {
  params: Promise<{
    qrCode: string;
  }>;
};

async function getTableMenu(qrCode: string) {
  await connectDB();

  const table = await Table.findOne({
    qrCode: qrCode.toUpperCase(),
  }).lean();

  if (!table) {
    return null;
  }

  const today = new Date();

  const [categories, menuItems, comboOffers] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),

    MenuItem.find({
      available: true,
    })
      .sort({ createdAt: -1 })
      .populate("category")
      .lean(),

    ComboOffer.find({
      active: true,
      $and: [
        {
          $or: [{ startDate: null }, { startDate: { $lte: today } }],
        },
        {
          $or: [{ endDate: null }, { endDate: { $gte: today } }],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .lean(),
  ]);

  return {
    table: JSON.parse(JSON.stringify(table)),
    categories: JSON.parse(JSON.stringify(categories)),
    menuItems: JSON.parse(JSON.stringify(menuItems)),
    comboOffers: JSON.parse(JSON.stringify(comboOffers)),
  };
}

export default async function CustomerTablePage({ params }: PageParams) {
  const { qrCode } = await params;

  const data = await getTableMenu(qrCode);

  if (!data) {
    notFound();
  }

  return (
    <CustomerMenuClient
      table={data.table}
      categories={data.categories}
      menuItems={data.menuItems}
      comboOffers={data.comboOffers}
    />
  );
}