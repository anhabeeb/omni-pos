export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  SUPERVISOR = 'SUPERVISOR',
  CASHIER = 'CASHIER',
  CHEF = 'CHEF',
  WAITER = 'WAITER'
}

export type ActivityAction = 
  | 'LOGIN' | 'LOGOUT'
  | 'STORE_CREATE' | 'STORE_UPDATE' | 'STORE_DELETE'
  | 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE'
  | 'EMP_CREATE' | 'EMP_UPDATE' | 'EMP_DELETE'
  | 'ORDER_CREATE' | 'ORDER_UPDATE' | 'ORDER_CANCEL' | 'ORDER_REFUND'
  | 'SHIFT_OPEN' | 'SHIFT_CLOSE'
  | 'MENU_UPDATE' | 'INV_UPDATE'
  | 'PERMISSION_UPDATE';

export interface SystemActivity {
  id: number;
  storeId: number | null; 
  userId: number;
  userName: string;
  action: ActivityAction;
  description: string;
  timestamp: number;
  metadata?: any;
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
  | 'VIEW_HISTORY'
  | 'VIEW_QUOTATIONS'
  | 'VIEW_LIVE_ACTIVITY'
  | 'VIEW_LOGS'; 

export interface RolePermissionConfig {
    role: UserRole;
    permissions: Permission[];
}

export interface User {
  id: number;
  userNumber?: number; 
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  storeIds: number[];
  phoneNumber?: string;
  email?: string;
}

export interface ActiveSession {
  userId: number;
  userName: string;
  role: UserRole;
  storeId: number | null;
  lastActive: number;
  deviceId?: string;
}

export interface Employee {
  id: number;
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
  id: number;
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
  useKOT?: boolean;
  useInventory?: boolean;
  printSettings?: PrintSettings;
  quotationSettings?: PrintSettings;
  eodSettings?: PrintSettings;
}

export interface Category {
  id: number;
  name: string;
  storeId: number;
  orderId?: number;
}

export interface RecipeItem {
  inventoryItemId: number;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  cost?: number;
  categoryId: number;
  isAvailable: boolean;
  imageUrl?: string;
  storeId?: number;
  recipe?: RecipeItem[]; 
}

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  minLevel: number;
  storeId: number;
}

export type CustomerType = 'INDIVIDUAL' | 'COMPANY';

export interface Customer {
  id: number;
  name?: string;
  phone: string;
  type: CustomerType;
  storeId: number;
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
  productId: number;
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
  performedBy: number;
  note?: string;
  referenceNumber?: string;
  tenderedAmount?: number;
  changeAmount?: number;
}

export interface Order {
  id: number;
  orderNumber: string; 
  storeId: number;
  shiftId?: number; 
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
  createdBy: number;
  createdAt: number;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  storeId: number;
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
  createdBy: number;
  createdAt: number;
}

export interface RegisterShift {
  id: number;
  shiftNumber?: number; 
  storeId: number;
  openedBy: number;
  openedAt: number;
  startingCash: number;
  openingDenominations?: Record<number, number>; 
  status: 'OPEN' | 'CLOSED';
  closedAt?: number;
  closedBy?: number;
  expectedCash?: number;
  actualCash?: number;
  closingDenominations?: Record<number, number>; 
  difference?: number;
  totalCashSales?: number;
  totalCashRefunds?: number;
  heldOrdersCount?: number;
  notes?: string;
}