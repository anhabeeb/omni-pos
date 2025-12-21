
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  CASHIER = 'CASHIER',
  CHEF = 'CHEF',
  WAITER = 'WAITER'
}

export type Permission = 
  | 'POS_ACCESS'
  | 'POS_CREATE_ORDER'
  | 'POS_EDIT_ORDER' 
  | 'POS_DELETE_ORDER' 
  | 'POS_REFUND'
  | 'POS_SETTLE'
  | 'POS_OPEN_CLOSE_REGISTER'
  | 'VIEW_REPORTS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_SETTINGS' 
  | 'MANAGE_PRINT_DESIGNER' 
  | 'MANAGE_STAFF'
  | 'VIEW_KOT'
  | 'PROCESS_KOT'
  | 'MANAGE_INVENTORY'
  | 'VIEW_LIVE_ACTIVITY'; 

export interface RolePermissionConfig {
    role: UserRole;
    permissions: Permission[];
}

export interface User {
  id: string;
  userNumber?: number; 
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  storeIds: string[];
}

export interface ActiveSession {
  userId: string;
  userName: string;
  role: UserRole;
  storeId: string | null;
  lastActive: number;
}

export interface Employee {
  id: string;
  empId: string;
  fullName: string;
  dob: string;
  nationality: string;
  idNumber: string;
  phoneNumber: string;
  emergencyContactNumber: string;
  emergencyContactPerson: string;
  emergencyRelation: string;
  createdAt: number;
}

export interface PrintSettings {
  headerText?: string;
  footerText?: string;
  showLogo?: boolean;
  logoUrl?: string;
  showStoreDetails?: boolean;
  showCashierName?: boolean;
  showCustomerDetails?: boolean;
  showTaxId?: boolean;
  taxIdLabel?: string;
  taxIdValue?: string;
  fontSize?: 'small' | 'medium' | 'large';
  paperSize: 'thermal' | 'a4' | 'a5' | 'letter';
  headerAlignment?: 'left' | 'center' | 'right';
  footerAlignment?: 'left' | 'center' | 'right';
  logoPosition?: 'left' | 'center' | 'right';
  currencySymbol?: string;
  showDate?: boolean;
  showOrderNumber?: boolean;
  showItems?: boolean;
  showQuantity?: boolean;
  showUnitPrice?: boolean;
  showAmount?: boolean;
  showSubtotal?: boolean;
  showServiceCharge?: boolean;
  showTax?: boolean;
  showTotal?: boolean;
}

export interface Store {
  id: string;
  name: string;
  currency: string; 
  address: string;
  phone: string;
  tin?: string;
  buildingName?: string;
  streetName?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  taxRate?: number;
  serviceChargeRate?: number;
  minStartingCash?: number; 
  numberOfTables?: number; 
  isActive: boolean;
  printSettings?: PrintSettings;
  quotationSettings?: PrintSettings;
  eodSettings?: PrintSettings;
}

export interface Category {
  id: string;
  name: string;
  orderId?: number;
}

export interface RecipeItem {
  inventoryItemId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  categoryId: string;
  isAvailable: boolean;
  imageUrl?: string;
  storeId?: string;
  recipe?: RecipeItem[]; 
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minLevel: number;
  storeId?: string;
}

export type CustomerType = 'INDIVIDUAL' | 'COMPANY';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  companyName?: string;
  tin?: string;
  houseName?: string;
  streetName?: string; 
  buildingName?: string; 
  street?: string;       
  island?: string;
  country?: string;
  address?: string; 
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEAWAY = 'TAKEAWAY',
  DELIVERY = 'DELIVERY'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  ON_HOLD = 'ON_HOLD'
}

export type KitchenStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface Transaction {
  id: string;
  type: 'PAYMENT' | 'REFUND' | 'REVERSAL' | 'CANCELLATION';
  amount: number;
  method?: 'CASH' | 'CARD' | 'TRANSFER';
  timestamp: number;
  performedBy: string;
  note?: string;
  tenderedAmount?: number;
  changeAmount?: number;
}

export interface Order {
  id: string;
  orderNumber: string; 
  storeId: string;
  shiftId?: string; 
  items: OrderItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  tax: number;
  serviceCharge: number;
  total: number;
  orderType: OrderType;
  status: OrderStatus;
  kitchenStatus?: KitchenStatus;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER';
  transactions?: Transaction[];
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerTin?: string;
  customerAddress?: string;
  note?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  storeId: string;
  customerName: string;
  customerPhone?: string;
  customerTin?: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  tax: number;
  total: number;
  validUntil?: number;
  createdBy: string;
  createdAt: number;
}

export interface RegisterShift {
  id: string;
  shiftNumber?: number; 
  storeId: string;
  openedBy: string;
  openedAt: number;
  startingCash: number;
  openingDenominations?: Record<number, number>; 
  status: 'OPEN' | 'CLOSED';
  closedAt?: number;
  closedBy?: string;
  expectedCash?: number;
  actualCash?: number;
  closingDenominations?: Record<number, number>; 
  difference?: number;
  totalCashSales?: number;
  totalCashRefunds?: number;
  heldOrdersCount?: number;
  notes?: string;
}
