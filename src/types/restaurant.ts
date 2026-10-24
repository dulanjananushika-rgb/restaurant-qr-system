import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@/domain/order/types";

export type IdName = { _id: string; name: string };

export type CategoryDto = IdName & {
  description?: string;
  createdAt?: string;
};

export type UserDto = IdName & {
  email?: string;
  role?: string;
  status?: string;
  workStatus?: string;
};

export type TableDto = IdName & {
  qrCode?: string;
  capacity?: number;
  status?: string;
  assignedWaiter?: UserDto | string | null;
};

export type MenuItemDto = IdName & {
  price: number;
  available?: boolean;
  image?: string;
  description?: string;
  category?: CategoryDto | string | null;
};

export type ComboSnapshotDto = {
  menuItem: MenuItemDto | string;
  name: string;
  quantity: number;
  priceSnapshot: number;
};

export type ComboOfferDto = IdName & {
  description?: string;
  image?: string;
  active?: boolean;
  originalPrice: number;
  offerPrice: number;
  startDate?: string | null;
  endDate?: string | null;
  items?: Array<{
    menuItem: MenuItemDto | string;
    quantity: number;
    priceSnapshot: number;
  }>;
};

export type PopulatedComboOfferDto = Omit<
  ComboOfferDto,
  "items" | "startDate" | "endDate"
> & {
  startDate?: string;
  endDate?: string;
  active: boolean;
  items: Array<{
    menuItem?: MenuItemDto;
    quantity: number;
    priceSnapshot: number;
  }>;
};

export type OrderItemDto = {
  _id: string;
  menuItem: MenuItemDto | string | null;
  quantity: number;
  price: number;
};

export type OrderComboDto = {
  _id: string;
  comboOffer: ComboOfferDto | string | null;
  quantity: number;
  price: number;
  originalPrice: number;
  comboItemsSnapshot?: ComboSnapshotDto[];
};

export type RestaurantOrderDto = {
  _id: string;
  table?: TableDto | string | null;
  diningSession?: DiningSessionDto | string | null;
  orderType: OrderType;
  customerName?: string;
  customerPhone?: string;
  items: OrderItemDto[];
  comboItems: OrderComboDto[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentType: PaymentType;
  assignedChef?: UserDto | string | null;
  assignedWaiter?: UserDto | string | null;
  waiterClaimedAt?: string | null;
  waiterClaimType?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type StatusHistoryDto = {
  _id?: string;
  fromStatus?: string;
  toStatus: string;
  changedByName?: string;
  changedByRole?: string;
  note?: string;
  changedAt: string;
};

export type PopulatedRestaurantOrderDto = Omit<
  RestaurantOrderDto,
  "table" | "items" | "comboItems"
> & {
  table?: TableDto | null;
  items: Array<Omit<OrderItemDto, "menuItem"> & { menuItem?: MenuItemDto }>;
  comboItems?: Array<
    Omit<OrderComboDto, "comboOffer" | "comboItemsSnapshot"> & {
      comboOffer?: ComboOfferDto;
      comboItemsSnapshot: Array<
        Omit<ComboSnapshotDto, "menuItem"> & { menuItem?: string }
      >;
    }
  >;
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  cancelledAt?: string | null;
  statusHistory?: StatusHistoryDto[];
};

export type ActiveKitchenOrderDto = Omit<
  PopulatedRestaurantOrderDto,
  "status"
> & {
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY";
};

export type DiningSessionDto = {
  _id: string;
  table?: TableDto | string | null;
  status: "OPEN" | "CLOSED";
  paymentStatus: "UNPAID" | "PAID";
  openedAt?: string;
  closedAt?: string | null;
};

export type PopulatedDiningSessionDto = Omit<DiningSessionDto, "table"> & {
  table?: TableDto | null;
  createdAt?: string;
};

export type PaymentDto = {
  _id: string;
  order?: RestaurantOrderDto | string | null;
  orders?: Array<RestaurantOrderDto | string>;
  diningSession?: DiningSessionDto | string | null;
  amount: number;
  method: PaymentMethod;
  status: "PAID" | "FAILED" | "REFUNDED";
  paidAt: string;
  note?: string;
  createdAt?: string;
};

export type InventoryItemDto = IdName & {
  unit: "kg" | "g" | "pcs" | "L" | "ml";
  quantity: number;
  minQuantity: number;
};

export type SupplierDto = IdName & {
  contactPerson?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
};

export type PurchaseDto = {
  _id: string;
  supplier?: IdName | string | null;
  invoiceNumber?: string;
  purchaseDate?: string;
  items: Array<{
    _id?: string;
    inventoryItem: InventoryItemDto | string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalAmount: number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIALLY_PAID";
  note?: string;
  createdAt?: string;
};

export type PopulatedPurchaseDto = Omit<
  PurchaseDto,
  "supplier" | "purchaseDate" | "createdAt" | "items"
> & {
  supplier?: SupplierDto;
  purchaseDate: string;
  createdAt: string;
  items: Array<{
    _id?: string;
    inventoryItem?: InventoryItemDto;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
};
