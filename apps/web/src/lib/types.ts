export interface User {
  id: string;
  name: string;
  email: string;
  brands: string[];
  brandSettings: { brand: string; discountBps: number }[];
}
export interface Client {
  id: string;
  name: string;
  phone: string;
  notes: string;
  openCents: number;
  paidCents: number;
  salesCount: number;
  sales?: Sale[];
}
export interface Product {
  id: string;
  name: string;
  brand: string;
  costCents: number;
  priceCents: number;
  catalogCents: number;
}
export interface Campaign {
  id: string;
  name: string;
  brand: string;
  startsOn: string;
  endsOn: string;
  salesCents: number;
  costCents: number;
  expenseCents: number;
  profitCents: number;
}
export interface Receipt {
  id: string;
  amountCents: number;
  paidOn: string;
  method: string;
  reversal: { reason: string; reversedOn: string } | null;
}
export interface Installment {
  id: string;
  number: number;
  amountCents: number;
  remainingCents: number;
  paidCents: number;
  dueOn: string;
  status: "PAID" | "OVERDUE" | "TODAY" | "PENDING" | "CANCELLED";
  receipts: Receipt[];
  sale: { id: string; clientId: string; client: Client; soldOn: string };
}
export interface Sale {
  id: string;
  client: Client;
  soldOn: string;
  paymentMethod: string;
  status: "ACTIVE" | "CANCELLED";
  discountCents: number;
  totalCents: number;
  items: {
    id: string;
    productName: string;
    quantity: number;
    priceCents: number;
    costCents: number;
  }[];
  installments: Omit<Installment, "sale">[];
}
export interface Expense {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  spentOn: string;
  brand: string | null;
  campaign: Campaign | null;
}
export interface Breakdown {
  id: string;
  name: string;
  salesCents: number;
  costCents: number;
  marginCents: number;
  quantity?: number;
}
export interface Report {
  from: string;
  to: string;
  salesCents: number;
  costCents: number;
  expenseCents: number;
  operatingCents: number;
  receivedCents: number;
  profitCents: number;
  cashCents: number;
  marginCents: number;
  receivedMarginCents: number;
  openMarginCents: number;
  salesCount: number;
  clients: Breakdown[];
  products: Breakdown[];
}
export interface Dashboard extends Report {
  openCents: number;
  overdueCents: number;
  debtorCount: number;
  todayCount: number;
  upcoming: Installment[];
}
export interface Data {
  clients: Client[];
  products: Product[];
  sales: Sale[];
  installments: Installment[];
  expenses: Expense[];
  campaigns: Campaign[];
  dashboard: Dashboard;
}
