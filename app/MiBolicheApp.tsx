"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  FileSpreadsheet,
  Home,
  Headphones,
  Landmark,
  Lightbulb,
  LogOut,
  Menu,
  Minus,
  Package,
  PackagePlus,
  Plus,
  ReceiptText,
  Scale,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Target,
  TrendingUp,
  UserPlus,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminPanel from "./AdminPanel";
import AuthPanel from "./AuthPanel";
import ProductEditor from "./ProductEditor";
import ProductImportModal from "./ProductImportModal";
import LegalDocument, { type LegalDocumentType } from "./LegalDocument";
import type { Session } from "@supabase/supabase-js";
import { initializeSupabase, supabase } from "./lib/supabase";
import {
  createProduct,
  importProducts,
  listInventoryMovements,
  listProducts,
  setProductStock,
  updateProduct,
  type InventoryMovement,
  type NewProduct,
  type Product,
} from "./lib/products";
import {
  closeCashDay,
  createExpense,
  listCashClosures,
  listExpenses,
  listSales,
  registerSale,
  saleErrorMessage,
  voidSale,
  type CashClosure,
  type Expense,
  type PaymentMethod,
  type Sale,
} from "./lib/commerce";
import { categoryDisplayName, categoryMatchesSearch } from "./lib/categories";
import { downloadCsv, isDateWithinRange } from "./lib/reporting";
import {
  getCurrentAccountRole,
  addBusinessMember,
  createSupportTicket,
  ensureCurrentUserBusiness,
  getBusinessProfile,
  saveBusinessProfile,
  saveWeeklyGoal,
  type BusinessProfile,
} from "./lib/business";
import {
  CashCloseModal,
  CashOperationsView,
  StockAdjustmentModal,
  VoidSaleModal,
} from "./DailyOperations";

type View =
  | "inicio"
  | "ventas"
  | "caja"
  | "inventario"
  | "finanzas"
  | "promociones"
  | "reportes"
  | "metas"
  | "configuracion";

type AccountRole = "client" | "admin";

type AccountIdentity = {
  fullName: string;
  businessName: string;
  businessType: string;
  rut: string;
  phone: string;
  address: string;
  commune: string;
  region: string;
};

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const formatMoney = (amount: number) => CLP.format(Math.round(amount));

const initialsFor = (value: string) => {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "MB";
};

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "ventas", label: "Ventas", icon: ShoppingCart },
  { id: "caja", label: "Caja", icon: WalletCards },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "finanzas", label: "Finanzas", icon: BarChart3 },
  { id: "promociones", label: "Promociones", icon: Tag },
  { id: "reportes", label: "Reportes", icon: FileSpreadsheet },
  { id: "metas", label: "Mi meta", icon: Target },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="miboliche.cl">
      <span className="brand-mark" aria-hidden="true">
        <Store size={compact ? 20 : 24} strokeWidth={2.4} />
        <TrendingUp size={compact ? 10 : 12} strokeWidth={3} />
      </span>
      {!compact && <span>miboliche.cl</span>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = "green" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "green" | "amber" | "blue" }) {
  return (
    <article className="stat-card">
      <span className={`icon-badge ${tone}`}><Icon size={22} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="icon-badge green"><Icon size={26} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function MiBolicheApp() {
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authRecovery, setAuthRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [legalDocument, setLegalDocument] = useState<LegalDocumentType | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole>("client");
  const [identity, setIdentity] = useState<AccountIdentity>({
    fullName: "Usuario",
    businessName: "Mi negocio",
    businessType: "Minimarket",
    rut: "",
    phone: "",
    address: "",
    commune: "",
    region: "Metropolitana",
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [commerceLoading, setCommerceLoading] = useState(false);
  const [commerceBusy, setCommerceBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [productBusy, setProductBusy] = useState<string | null>(null);
  const [view, setView] = useState<View>("inicio");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState(1_000_000);
  const [globalQuery, setGlobalQuery] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"Todos" | "Stock bajo" | "Por vencer">("Todos");
  const [saleOpen, setSaleOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [cashCloseOpen, setCashCloseOpen] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [saleQuery, setSaleQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<PaymentMethod>("Efectivo");
  const [toast, setToast] = useState("");
  const [reportFrom, setReportFrom] = useState(() => {
    const date = new Date();
    return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
  });
  const [reportTo, setReportTo] = useState(() => localDateKey());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      localStorage.removeItem("mb-sales");
      localStorage.removeItem("mb-expenses");
      localStorage.removeItem("mb-products");
      setMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    let authFallback: number | undefined;
    let unsubscribeAuth: (() => void) | undefined;

    const applySession = (session: Session | null) => {
      if (!active) return;

      if (!session) {
        setAuthenticated(false);
        setAccountRole("client");
        setIdentity({
          fullName: "Usuario",
          businessName: "Mi negocio",
          businessType: "Minimarket",
          rut: "",
          phone: "",
          address: "",
          commune: "",
          region: "Metropolitana",
        });
        setBusinessId(null);
        setCurrentUserId(null);
        setProducts([]);
        setSales([]);
        setExpenses([]);
        setCashClosures([]);
        setInventoryMovements([]);
        setProductsLoading(false);
        setCommerceLoading(false);
        setAuthChecked(true);
        return;
      }

      const metadata = session.user.user_metadata as Record<string, unknown>;
      const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const metadataBusinessName = typeof metadata.business_name === "string" ? metadata.business_name.trim() : "";
      const fallbackName = session.user.email?.split("@")[0] || "Usuario";
      const sessionIdentity = {
        fullName: metadataFullName || fallbackName,
        businessName: metadataBusinessName || "Mi negocio",
        businessType: "Minimarket",
        rut: "",
        phone: "",
        address: "",
        commune: "",
        region: "Metropolitana",
      };

      setAccountRole("client");
      setIdentity(sessionIdentity);
      setCurrentUserId(session.user.id);
      setAuthenticated(true);
      setAuthNotice("");
      setAuthChecked(true);

      if (supabase) {
        void (async () => {
          const [profileResult, roleResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", session.user.id)
              .maybeSingle(),
            getCurrentAccountRole(supabase).catch(() => "client" as const),
          ]);

          if (active) setAccountRole(roleResult);

          const business = roleResult === "admin"
            ? null
            : await ensureCurrentUserBusiness(supabase);

          if (!active) return;

          setIdentity({
            ...sessionIdentity,
            fullName: profileResult.data?.full_name?.trim() || sessionIdentity.fullName,
            businessName: business?.name?.trim() || sessionIdentity.businessName,
          });
          setBusinessId(business?.id || null);

          if (!business?.id) {
            setProducts([]);
            if (roleResult !== "admin") {
              setToast("No pudimos preparar tu negocio. Revisa la activación en Supabase.");
            }
            return;
          }

          if (business.createdNow) {
            setToast("Tu negocio quedó creado y vinculado correctamente.");
          }

          const cachedGoal = Number(localStorage.getItem(`mb-weekly-goal:${business.id}`));
          if (Number.isFinite(cachedGoal) && cachedGoal >= 10_000) {
            setWeeklyGoal(cachedGoal);
          }

          setProductsLoading(true);
          setCommerceLoading(true);
          try {
            const [productResult, salesResult, expenseResult, closureResult, movementResult, profileResult] =
              await Promise.allSettled([
                listProducts(supabase, business.id),
                listSales(supabase, business.id),
                listExpenses(supabase, business.id),
                listCashClosures(supabase, business.id),
                listInventoryMovements(supabase, business.id),
                getBusinessProfile(supabase, business.id),
              ]);
            if (active) {
              if (productResult.status === "fulfilled") {
                setProducts(productResult.value);
              }
              if (salesResult.status === "fulfilled") {
                setSales(salesResult.value);
              }
              if (expenseResult.status === "fulfilled") {
                setExpenses(expenseResult.value);
              }
              if (closureResult.status === "fulfilled") {
                setCashClosures(closureResult.value);
              }
              if (movementResult.status === "fulfilled") {
                setInventoryMovements(movementResult.value);
              }
              if (profileResult.status === "fulfilled") {
                setIdentity({
                  fullName: profileResult.value.administratorName || sessionIdentity.fullName,
                  businessName: profileResult.value.businessName,
                  businessType: profileResult.value.businessType,
                  rut: profileResult.value.rut,
                  phone: profileResult.value.phone,
                  address: profileResult.value.address,
                  commune: profileResult.value.commune,
                  region: profileResult.value.region,
                });
                setWeeklyGoal(profileResult.value.weeklyGoal);
                localStorage.setItem(
                  `mb-weekly-goal:${business.id}`,
                  String(profileResult.value.weeklyGoal),
                );
              } else {
                setToast("No pudimos sincronizar la meta semanal. Se mantendrá el último valor guardado.");
              }
              if (
                productResult.status === "rejected" ||
                salesResult.status === "rejected" ||
                expenseResult.status === "rejected" ||
                closureResult.status === "rejected" ||
                movementResult.status === "rejected"
              ) {
                setToast("Algunos datos no pudieron actualizarse. Puedes seguir usando las secciones disponibles.");
              }
            }
          } finally {
            if (active) {
              setProductsLoading(false);
              setCommerceLoading(false);
            }
          }
        })();

      }
    };

    void initializeSupabase().then((client) => {
      if (!active) return;

      if (!client) {
        setAuthNotice(
          "La conexión segura con Supabase no está configurada en este entorno.",
        );
        setAuthChecked(true);
        return;
      }

      authFallback = window.setTimeout(() => {
        if (active) setAuthChecked(true);
      }, 4000);

      void client.auth.getSession()
        .then(({ data }) => applySession(data.session))
        .catch(() => {
          if (!active) return;
          setAuthenticated(false);
          setAuthNotice("No pudimos comprobar tu sesión. Inténtalo nuevamente.");
          setAuthChecked(true);
        });

      const { data: authListener } = client.auth.onAuthStateChange(
        (event, session) => {
          if (event === "PASSWORD_RECOVERY") {
            setAuthRecovery(true);
            setAuthenticated(false);
            setAuthChecked(true);
            return;
          }
          void applySession(session);
        },
      );
      unsubscribeAuth = () => authListener.subscription.unsubscribe();
    });

    return () => {
      active = false;
      if (authFallback !== undefined) window.clearTimeout(authFallback);
      unsubscribeAuth?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const today = localDateKey();
  const startOfWeek = useMemo(() => {
    const date = new Date();
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const startOfMonth = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);
  const referenceTime = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);

  const saleTotal = (sale: Sale) => sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const saleCost = (sale: Sale) => sale.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const completedSales = useMemo(
    () => sales.filter((sale) => sale.status !== "voided"),
    [sales],
  );
  const salesForToday = completedSales.filter((sale) => localDateKey(new Date(sale.date)) === today);
  const salesThisWeek = completedSales.filter((sale) => new Date(sale.date) >= startOfWeek);
  const salesThisMonth = completedSales.filter((sale) => new Date(sale.date) >= startOfMonth);
  const expensesThisMonth = expenses.filter((expense) => new Date(expense.date) >= startOfMonth);
  const salesToday = salesForToday.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const cashSalesToday = salesForToday
    .filter((sale) => sale.payment === "Efectivo")
    .reduce((sum, sale) => sum + saleTotal(sale), 0);
  const weeklySales = salesThisWeek.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const monthSales = salesThisMonth.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const monthCost = salesThisMonth.reduce((sum, sale) => sum + saleCost(sale), 0);
  const grossProfit = monthSales - monthCost;
  const monthExpenses = expensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0);
  const estimatedResult = grossProfit - monthExpenses;
  const averageTicket = salesThisMonth.length ? monthSales / salesThisMonth.length : 0;
  const grossMarginRate = monthSales > 0 ? Math.round((grossProfit / monthSales) * 100) : 0;
  const paymentBreakdown = (["Efectivo", "Tarjeta", "Transferencia"] as const).map((method) => {
    const methodSales = salesThisMonth.filter((sale) => sale.payment === method);
    return {
      method,
      count: methodSales.length,
      total: methodSales.reduce((sum, sale) => sum + saleTotal(sale), 0),
    };
  });
  const highestPaymentTotal = Math.max(0, ...paymentBreakdown.map((item) => item.total));
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat("es-CL", { weekday: "short" })
        .format(date)
        .replace(".", ""),
      total: completedSales
        .filter((sale) => localDateKey(new Date(sale.date)) === key)
        .reduce((sum, sale) => sum + saleTotal(sale), 0),
    };
  });
  const highestDailySale = Math.max(0, ...dailySales.map((day) => day.total));
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 29);
    return date;
  }, []);
  const productPerformance = useMemo(() => {
    const performance = new Map<string, { productId: string; name: string; units: number; revenue: number; profit: number }>();
    completedSales
      .filter((sale) => new Date(sale.date) >= thirtyDaysAgo)
      .forEach((sale) => {
        sale.items.forEach((item) => {
          const current = performance.get(item.productId) || {
            productId: item.productId,
            name: item.name,
            units: 0,
            revenue: 0,
            profit: 0,
          };
          current.units += item.quantity;
          current.revenue += item.quantity * item.unitPrice;
          current.profit += item.quantity * (item.unitPrice - item.unitCost);
          performance.set(item.productId, current);
        });
      });
    return performance;
  }, [completedSales, thirtyDaysAgo]);
  const topSellingProduct = [...productPerformance.values()]
    .filter((item) => products.some((product) => product.id === item.productId && product.stock > 0))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)[0] || null;
  const topSellingInventoryProduct = topSellingProduct
    ? products.find((product) => product.id === topSellingProduct.productId) || null
    : null;
  const lowStock = products.filter((product) => product.stock <= product.minStock);
  const expiringSoon = products.filter((product) => {
    if (!product.expiry) return false;
    const days = (new Date(product.expiry).getTime() - referenceTime) / 86_400_000;
    return days >= 0 && days <= 7;
  });
  const bestMarginProduct = products.reduce<Product | null>((best, product) => {
    if (product.stock <= 0 || product.price <= product.cost) return best;
    if (!best) return product;
    return product.price - product.cost > best.price - best.cost ? product : best;
  }, null);
  const comboProducts = useMemo(() => {
    const rankedProducts = [...products].sort(
      (a, b) => (productPerformance.get(b.id)?.units || 0) - (productPerformance.get(a.id)?.units || 0),
    );
    const beverage = rankedProducts.find((product) =>
      ["Bebidas gaseosas", "Aguas", "Jugos y néctares", "Bebidas energéticas e isotónicas"]
        .includes(product.category) && product.stock > 0,
    );
    const snack = rankedProducts.find((product) =>
      ["Papas fritas y snacks salados", "Galletas", "Chocolates y confites", "Frutos secos y barras"]
        .includes(product.category) && product.stock > 0,
    );
    return beverage && snack ? [beverage, snack] as const : null;
  }, [productPerformance, products]);
  const comboPrice = comboProducts
    ? Math.max(0, Math.round((comboProducts[0].price + comboProducts[1].price) * 0.9 / 10) * 10)
    : 0;
  const reportSales = completedSales.filter((sale) =>
    isDateWithinRange(sale.date, reportFrom, reportTo),
  );
  const reportExpenses = expenses.filter((expense) =>
    isDateWithinRange(expense.date, reportFrom, reportTo),
  );
  const reportRevenue = reportSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const reportCost = reportSales.reduce((sum, sale) => sum + saleCost(sale), 0);
  const reportExpenseTotal = reportExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const reportResult = reportRevenue - reportCost - reportExpenseTotal;
  const reportProductPerformance = useMemo(() => {
    const performance = new Map<string, { name: string; units: number; revenue: number; profit: number }>();
    reportSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = performance.get(item.productId) || {
          name: item.name,
          units: 0,
          revenue: 0,
          profit: 0,
        };
        current.units += item.quantity;
        current.revenue += item.quantity * item.unitPrice;
        current.profit += item.quantity * (item.unitPrice - item.unitCost);
        performance.set(item.productId, current);
      });
    });
    return [...performance.values()].sort(
      (a, b) => b.units - a.units || b.revenue - a.revenue,
    );
  }, [reportSales]);
  const progress = weeklyGoal > 0 ? Math.min(100, Math.round((weeklySales / weeklyGoal) * 100)) : 0;
  const missingGoal = Math.max(0, weeklyGoal - weeklySales);
  const firstName = identity.fullName.trim().split(/\s+/)[0] || "Usuario";
  const userInitials = initialsFor(identity.fullName);
  const businessInitials = initialsFor(identity.businessName);

  const searchMatches = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return products.filter((product) => product.name.toLowerCase().includes(query) || product.barcode.includes(query)).slice(0, 5);
  }, [globalQuery, products]);

  const filteredInventory = useMemo(() => {
    const query = inventoryQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(query) ||
        product.barcode.includes(query) ||
        categoryMatchesSearch(product.category, query);
      const isLow = product.stock <= product.minStock;
      const isExpiring = product.expiry && (new Date(product.expiry).getTime() - referenceTime) / 86_400_000 <= 7;
      return matchesQuery && (inventoryFilter === "Todos" || (inventoryFilter === "Stock bajo" && isLow) || (inventoryFilter === "Por vencer" && isExpiring));
    });
  }, [inventoryFilter, inventoryQuery, products, referenceTime]);

  const draftItems = Object.entries(draft)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ product: products.find((product) => product.id === id)!, quantity }))
    .filter((item) => item.product);
  const draftTotal = draftItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const navigate = (nextView: View) => {
    setView(nextView);
    setMobileMenu(false);
    setGlobalQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reviewProduct = (productName: string) => {
    setInventoryQuery(productName);
    setInventoryFilter("Todos");
    navigate("inventario");
  };

  const showToast = (message: string) => setToast(message);

  const persistBusinessProfile = async (successMessage: string) => {
    if (!supabase || !businessId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    if (!identity.businessName.trim() || !identity.fullName.trim()) {
      showToast("Completa el nombre del negocio y de la persona administradora");
      return;
    }
    if (weeklyGoal < 10_000) {
      showToast("La meta semanal debe ser de al menos $10.000");
      return;
    }

    const profile: BusinessProfile = {
      businessId,
      businessName: identity.businessName,
      businessType: identity.businessType,
      administratorName: identity.fullName,
      rut: identity.rut,
      phone: identity.phone,
      address: identity.address,
      commune: identity.commune,
      region: identity.region,
      weeklyGoal,
    };

    setProfileBusy(true);
    try {
      const saved = await saveBusinessProfile(supabase, profile);
      setIdentity({
        fullName: saved.administratorName,
        businessName: saved.businessName,
        businessType: saved.businessType,
        rut: saved.rut,
        phone: saved.phone,
        address: saved.address,
        commune: saved.commune,
        region: saved.region,
      });
      setWeeklyGoal(saved.weeklyGoal);
      showToast(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(
        message.includes("could not find") || message.includes("schema cache")
          ? "Activa primero la ficha del negocio en Supabase."
          : "No pudimos guardar los cambios. Inténtalo nuevamente.",
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const persistWeeklyGoal = async () => {
    if (!supabase || !businessId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    if (!Number.isFinite(weeklyGoal) || weeklyGoal < 10_000) {
      showToast("La meta semanal debe ser de al menos $10.000");
      return;
    }

    setProfileBusy(true);
    try {
      const savedGoal = await saveWeeklyGoal(supabase, businessId, weeklyGoal);
      const confirmedProfile = await getBusinessProfile(supabase, businessId);
      if (confirmedProfile.weeklyGoal !== savedGoal) {
        throw new Error("La meta guardada no coincide con la ficha del negocio.");
      }
      setWeeklyGoal(confirmedProfile.weeklyGoal);
      localStorage.setItem(
        `mb-weekly-goal:${businessId}`,
        String(confirmedProfile.weeklyGoal),
      );
      showToast("Meta semanal guardada en tu cuenta");
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(
        message.includes("could not find") || message.includes("schema cache")
          ? "Falta activar la actualización de la meta en Supabase."
          : message.includes("no está habilitado")
            ? "La cuenta está suspendida y no permite guardar cambios."
            : "No pudimos guardar la meta semanal. Inténtalo nuevamente.",
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const saveTeamMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !businessId) return showToast("Primero debes tener un negocio asociado");
    const form = event.currentTarget;
    const data = new FormData(form);
    setProfileBusy(true);
    try {
      await addBusinessMember(
        supabase,
        businessId,
        String(data.get("memberEmail") || "").trim(),
        String(data.get("memberRole")) as "manager" | "seller",
      );
      form.reset();
      showToast("Usuario asociado correctamente");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      showToast(message.includes("aún no tiene") ? "Ese correo debe crear primero su cuenta" : "No pudimos asociar a ese usuario");
    } finally {
      setProfileBusy(false);
    }
  };

  const sendSupportTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !businessId) return showToast("Primero debes tener un negocio asociado");
    const form = event.currentTarget;
    const data = new FormData(form);
    setProfileBusy(true);
    try {
      await createSupportTicket(
        supabase,
        businessId,
        String(data.get("ticketSubject") || "").trim(),
        String(data.get("ticketDescription") || "").trim(),
        String(data.get("ticketPriority")) as "low" | "medium" | "high",
      );
      form.reset();
      showToast("Solicitud enviada a soporte");
    } catch {
      showToast("No pudimos enviar la solicitud");
    } finally {
      setProfileBusy(false);
    }
  };

  const reportFilename = (name: string) =>
    `${name}-${reportFrom}-a-${reportTo}.csv`;

  const exportInventory = () => {
    downloadCsv(reportFilename("inventario"), [
      ["Código de barras", "Producto", "Categoría", "Costo", "Precio de venta", "Stock actual", "Stock mínimo", "Vencimiento", "Valor a costo"],
      ...products.map((product) => [
        product.barcode,
        product.name,
        categoryDisplayName(product.category),
        product.cost,
        product.price,
        product.stock,
        product.minStock,
        product.expiry || "",
        product.cost * product.stock,
      ]),
    ]);
    showToast("Inventario descargado para Excel");
  };

  const exportSales = () => {
    const rows = reportSales.flatMap((sale) =>
      sale.items.map((item) => [
        sale.id,
        new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(sale.date)),
        sale.payment,
        item.name,
        item.quantity,
        item.unitPrice,
        item.unitCost,
        item.quantity * item.unitPrice,
        item.quantity * (item.unitPrice - item.unitCost),
      ]),
    );
    downloadCsv(reportFilename("ventas"), [
      ["ID venta", "Fecha", "Medio de pago", "Producto", "Cantidad", "Precio unitario", "Costo unitario", "Subtotal", "Utilidad bruta"],
      ...rows,
    ]);
    showToast("Ventas descargadas para Excel");
  };

  const exportExpenses = () => {
    downloadCsv(reportFilename("gastos"), [
      ["Fecha", "Descripción", "Categoría", "Monto"],
      ...reportExpenses.map((expense) => [
        new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(expense.date)),
        expense.label,
        expense.category || "Otros",
        expense.amount,
      ]),
    ]);
    showToast("Gastos descargados para Excel");
  };

  const exportSummary = () => {
    downloadCsv(reportFilename("resumen-financiero"), [
      ["Mi Boliche", identity.businessName],
      ["Desde", reportFrom],
      ["Hasta", reportTo],
      [],
      ["Indicador", "Monto"],
      ["Ventas", reportRevenue],
      ["Costo de productos vendidos", reportCost],
      ["Utilidad bruta", reportRevenue - reportCost],
      ["Gastos", reportExpenseTotal],
      ["Resultado estimado antes de impuestos", reportResult],
      [],
      ["Medio de pago", "Ventas", "Monto"],
      ...(["Efectivo", "Tarjeta", "Transferencia"] as const).map((method) => {
        const methodSales = reportSales.filter((sale) => sale.payment === method);
        return [
          method,
          methodSales.length,
          methodSales.reduce((sum, sale) => sum + saleTotal(sale), 0),
        ];
      }),
    ]);
    showToast("Resumen financiero descargado");
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAuthenticated(false);
    setAccountRole("client");
    setAuthRecovery(false);
    setView("inicio");
  };

  const finishPasswordRecovery = () => {
    setAuthRecovery(false);
    setAuthenticated(true);
  };

  const updateDraft = (productId: string, delta: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setDraft((current) => {
      const next = Math.max(0, Math.min(product.stock, (current[productId] || 0) + delta));
      return { ...current, [productId]: next };
    });
  };

  const refreshCommerce = async () => {
    if (!supabase || !businessId) return;
    const [productResult, salesResult, expenseResult, closureResult, movementResult] =
      await Promise.allSettled([
        listProducts(supabase, businessId),
        listSales(supabase, businessId),
        listExpenses(supabase, businessId),
        listCashClosures(supabase, businessId),
        listInventoryMovements(supabase, businessId),
      ]);

    if (productResult.status === "fulfilled") {
      setProducts(productResult.value);
    }
    if (salesResult.status === "fulfilled") {
      setSales(salesResult.value);
    }
    if (expenseResult.status === "fulfilled") {
      setExpenses(expenseResult.value);
    }
    if (closureResult.status === "fulfilled") {
      setCashClosures(closureResult.value);
    }
    if (movementResult.status === "fulfilled") {
      setInventoryMovements(movementResult.value);
    }
  };

  const confirmSale = async () => {
    if (!draftItems.length || !supabase || !businessId) return;
    setCommerceBusy(true);
    try {
      const saleId = await registerSale(
        supabase,
        businessId,
        payment,
        draftItems,
      );
      const completedSale: Sale = {
        id: saleId,
        date: new Date().toISOString(),
        payment,
        status: "completed",
        items: draftItems.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: product.price,
          unitCost: product.cost,
        })),
      };

      setSales((current) => [
        completedSale,
        ...current.filter((sale) => sale.id !== saleId),
      ]);
      setProducts((current) =>
        current.map((product) => {
          const sold = draftItems.find(
            (item) => item.product.id === product.id,
          );
          return sold
            ? { ...product, stock: product.stock - sold.quantity }
            : product;
        }),
      );
      setDraft({});
      setSaleQuery("");
      setSaleOpen(false);
      showToast(`Venta registrada por ${formatMoney(draftTotal)}`);
      void refreshCommerce();
    } catch (error) {
      console.error("No se pudo registrar la venta", error);
      const message = saleErrorMessage(error);
      showToast(message);
    } finally {
      setCommerceBusy(false);
    }
  };

  const addProduct = async (newProduct: NewProduct) => {
    if (!supabase || !businessId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    setProductBusy("new");

    try {
      const product = await createProduct(supabase, businessId, newProduct);
      setProducts((current) => [product, ...current]);
      setProductOpen(false);
      showToast("Producto guardado en tu inventario");
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(message.includes("duplicate") || message.includes("unique")
        ? "Ese código de barras ya está registrado en tu negocio."
        : "No pudimos guardar el producto. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setProductBusy(null);
    }
  };

  const bulkImportProducts = async (newProducts: NewProduct[]) => {
    if (!supabase || !businessId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    setProductBusy("bulk-import");
    try {
      const imported = await importProducts(supabase, businessId, newProducts);
      setProducts((current) => [...imported, ...current]);
      setProductImportOpen(false);
      showToast(`${imported.length} productos importados correctamente`);
    } catch {
      showToast("No pudimos importar los productos. Revisa el archivo e inténtalo nuevamente.");
    } finally {
      setProductBusy(null);
    }
  };

  const saveProductChanges = async (product: Product, changes: NewProduct) => {
    if (!supabase || !businessId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    setProductBusy(product.id);
    try {
      const updated = await updateProduct(supabase, businessId, product.id, changes);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingProduct(null);
      setProductOpen(false);
      showToast("Producto y precios actualizados");
    } catch {
      showToast("No pudimos actualizar el producto.");
    } finally {
      setProductBusy(null);
    }
  };

  const adjustProduct = async (newStock: number, reason: string) => {
    if (!supabase || !businessId || !productToAdjust) {
      showToast("No pudimos identificar tu negocio");
      return;
    }

    setProductBusy(productToAdjust.id);
    try {
      const updated = await setProductStock(
        supabase,
        businessId,
        productToAdjust,
        newStock,
        reason,
      );
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setProductToAdjust(null);
      showToast(`Stock de ${updated.name} actualizado a ${updated.stock}`);
      void refreshCommerce();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(message.includes("could not find") || message.includes("schema cache")
        ? "Activa primero el módulo de caja y ajustes en Supabase."
        : "No pudimos ajustar el stock. No se aplicaron cambios.");
    } finally {
      setProductBusy(null);
    }
  };

  const confirmVoidSale = async (reason: string) => {
    if (!supabase || !businessId || !saleToVoid) return;
    setCommerceBusy(true);
    try {
      const target = saleToVoid;
      await voidSale(supabase, businessId, target.id, reason);
      setSales((current) => current.map((sale) => sale.id === target.id
        ? { ...sale, status: "voided", voidReason: reason, voidedAt: new Date().toISOString() }
        : sale));
      setProducts((current) => current.map((product) => {
        const returned = target.items
          .filter((item) => item.productId === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);
        return returned ? { ...product, stock: product.stock + returned } : product;
      }));
      setSaleToVoid(null);
      showToast("Venta anulada y productos devueltos al inventario");
      void refreshCommerce();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(message.includes("could not find") || message.includes("schema cache")
        ? "Activa primero el módulo de caja y anulaciones en Supabase."
        : "No pudimos anular la venta. No se aplicaron cambios.");
    } finally {
      setCommerceBusy(false);
    }
  };

  const saveCashClosure = async (values: {
    businessDate: string;
    openingCash: number;
    otherCashIn: number;
    cashOut: number;
    countedCash: number;
    note: string;
  }) => {
    if (!supabase || !businessId) return;
    setCommerceBusy(true);
    try {
      const closure = await closeCashDay(supabase, businessId, values);
      setCashClosures((current) => [
        closure,
        ...current.filter((item) => item.id !== closure.id && item.businessDate !== closure.businessDate),
      ].sort((a, b) => b.businessDate.localeCompare(a.businessDate)));
      setCashCloseOpen(false);
      showToast(closure.difference === 0
        ? "Cierre guardado: la caja está cuadrada"
        : `Cierre guardado con diferencia de ${formatMoney(closure.difference)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase("es") : "";
      showToast(message.includes("could not find") || message.includes("schema cache") || message.includes("cash_closures")
        ? "Activa primero el módulo de caja y ajustes en Supabase."
        : "No pudimos guardar el cierre de caja.");
    } finally {
      setCommerceBusy(false);
    }
  };

  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !businessId || !currentUserId) {
      showToast("No pudimos identificar tu negocio");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setCommerceBusy(true);
    try {
      const expense = await createExpense(supabase, currentUserId, businessId, {
        description: String(data.get("label")),
        category: String(data.get("category") || "Otros"),
        amount: Number(data.get("amount")),
      });
      setExpenses((current) => [expense, ...current]);
      form.reset();
      setExpenseOpen(false);
      showToast("Gasto registrado correctamente");
    } catch {
      showToast("No pudimos registrar el gasto.");
    } finally {
      setCommerceBusy(false);
    }
  };

  if (!mounted || !authChecked) return <div className="loading-screen"><Logo /><span className="loader" /></div>;

  if (!authenticated || authRecovery) {
    return (
      <AuthPanel
        recoveryMode={authRecovery}
        notice={authNotice}
        onRecoveryComplete={finishPasswordRecovery}
      />
    );
  }

  if (accountRole === "admin") return <AdminPanel onLogout={logout} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="business-pill"><span>{businessInitials}</span><div><strong>{identity.businessName}</strong><small>Minimarket</small></div><ChevronDown size={17} /></div>
        <nav aria-label="Navegación principal">
          <p>MI NEGOCIO</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} />{item.label}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className={view === "configuracion" ? "active" : ""} onClick={() => navigate("configuracion")}><Settings size={20} />Configuración</button>
          <button onClick={logout}><LogOut size={20} />Cerrar sesión</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Menu size={24} /></button>
          <div className="mobile-top-logo"><Logo compact /></div>
          <div className="global-search">
            <Search size={20} />
            <input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Busca un producto o código..." aria-label="Buscar producto" />
            <span className="search-shortcut">⌘ K</span>
            {searchMatches.length > 0 && <div className="search-results">{searchMatches.map((product) => <button key={product.id} onClick={() => { navigate("inventario"); setInventoryQuery(product.name); }}><span className="product-mini-icon"><Package size={17} /></span><div><strong>{product.name}</strong><small>{product.barcode} · {product.stock} unidades</small></div><ChevronRight size={17} /></button>)}</div>}
          </div>
          <div className="top-actions"><button className="icon-button notification" aria-label="Notificaciones"><Bell size={21} /><span>{lowStock.length}</span></button><div className="profile"><span>{userInitials}</span><div><strong>{identity.fullName}</strong><small>Propietario/a</small></div><ChevronDown size={16} /></div></div>
        </header>

        <section className="page-content">
          {view === "inicio" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">RESUMEN DEL NEGOCIO</span><h1>Hola, {firstName} <span aria-hidden="true">👋</span></h1><p>Así va {identity.businessName} hoy, {new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}.</p></div><button className="primary-button" onClick={() => setSaleOpen(true)}><Plus size={20} /> Ingresar venta</button></div>

              <div className="dashboard-grid">
                <article className="goal-card">
                  <div className="goal-top"><div><span className="eyebrow">META SEMANAL</span><h2>Tu avance de ventas</h2></div><button className="subtle-button" onClick={() => navigate("metas")}>Ver meta <ChevronRight size={16} /></button></div>
                  <div className="goal-body">
                    <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>completado</span></div></div>
                    <div className="goal-numbers"><span>Ventas esta semana</span><strong>{formatMoney(weeklySales)}</strong><p>de una meta de <b>{formatMoney(weeklyGoal)}</b></p><div className={missingGoal ? "goal-message" : "goal-message success"}>{missingGoal ? <><TrendingUp size={18} /> Te faltan <b>{formatMoney(missingGoal)}</b> para tu meta</> : <><CheckCircle2 size={18} /> ¡Superaste tu meta semanal!</>}</div></div>
                  </div>
                </article>
                <div className="stats-stack">
                  <StatCard icon={CircleDollarSign} label="Ventas de hoy" value={formatMoney(salesToday)} detail={`${salesForToday.length} ventas registradas`} />
                  <StatCard icon={TrendingUp} label="Utilidad bruta del mes" value={formatMoney(grossProfit)} detail={`${grossMarginRate}% de margen bruto`} tone="blue" />
                </div>
                <aside className="attention-card">
                  <div className="attention-title"><span className="icon-badge amber"><AlertTriangle size={22} /></span><div><span className="eyebrow amber-text">{products.length ? "NECESITA ATENCIÓN" : "PRIMER PASO"}</span><h3>{products.length ? `${lowStock.length} productos con stock bajo` : "Agrega tu primer producto"}</h3></div></div>
                  <div className="attention-products">{lowStock.slice(0, 3).map((product) => <button key={product.id} onClick={() => { navigate("inventario"); setInventoryQuery(product.name); }}><span className="product-mini-icon warning"><Package size={17} /></span><div><strong>{product.name}</strong><small>Quedan {product.stock} · Mínimo {product.minStock}</small></div><ChevronRight size={16} /></button>)}</div>
                  <button className="outline-button full" onClick={() => { navigate("inventario"); if (products.length) setInventoryFilter("Stock bajo"); else setProductOpen(true); }}>{products.length ? "Ver inventario crítico" : "Crear inventario"}</button>
                </aside>
              </div>

              <div className="section-heading"><div><h2>¿Qué quieres hacer?</h2><p>Accesos rápidos para tu día a día.</p></div></div>
              <div className="quick-grid">
                <button className="quick-card primary" onClick={() => setSaleOpen(true)}><span><Plus size={38} /></span><div><strong>Ingresar ventas</strong><small>Registra una venta nueva</small></div><ChevronRight size={20} /></button>
                <button className="quick-card" onClick={() => navigate("inventario")}><span><Box size={35} /></span><div><strong>Inventario</strong><small>Revisa y repone productos</small></div><ChevronRight size={20} /></button>
                <button className="quick-card" onClick={() => navigate("finanzas")}><span><BarChart3 size={35} /></span><div><strong>Utilidad</strong><small>Entiende tus resultados</small></div><ChevronRight size={20} /></button>
                <button className="quick-card" onClick={() => navigate("metas")}><span><Target size={35} /></span><div><strong>Mi meta</strong><small>Revisa tu progreso</small></div><ChevronRight size={20} /></button>
              </div>

              <div className="lower-grid">
                <article className="panel recommendation-panel"><div className="panel-title"><div><span className="icon-badge green"><Lightbulb size={21} /></span><div><span className="eyebrow">RECOMENDACIÓN DE HOY</span><h3>{comboProducts ? "Vende más con un combo" : "Ideas basadas en tus productos"}</h3></div></div>{comboProducts && <span className="new-pill">Idea nueva</span>}</div>{comboProducts ? <><div className="combo-visual"><span>🥤</span><Plus size={20} /><span>🍿</span><div><strong>{comboProducts[0].name} + {comboProducts[1].name}</strong><small>Precio conjunto sugerido: {formatMoney(comboPrice)}</small></div></div><button className="outline-button" onClick={() => navigate("promociones")}>Ver sugerencia <ArrowUpRight size={17} /></button></> : <EmptyState icon={Tag} title="Aún no hay una sugerencia" text="Agrega una bebida y un snack para preparar un combo con datos reales." />}</article>
                <article className="panel recent-panel"><div className="panel-title"><div><span className="icon-badge blue"><ReceiptText size={21} /></span><div><span className="eyebrow">ÚLTIMOS MOVIMIENTOS</span><h3>Ventas recientes</h3></div></div><button className="text-button" onClick={() => navigate("ventas")}>Ver todas</button></div>{commerceLoading ? <EmptyState icon={ReceiptText} title="Cargando ventas" text="Estamos recuperando los movimientos del negocio." /> : sales.length ? sales.slice(0, 3).map((sale) => <div className="recent-row" key={sale.id}><span className="product-mini-icon"><ReceiptText size={17} /></span><div><strong>Venta #{String(sale.id).slice(-4)}</strong><small>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} productos · {sale.payment}</small></div><b>{formatMoney(saleTotal(sale))}</b></div>) : <EmptyState icon={ReceiptText} title="Aún no hay ventas" text="Tu primera venta aparecerá aquí y alimentará las finanzas." />}</article>
              </div>
            </>
          )}

          {view === "ventas" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">MOVIMIENTOS</span><h1>Ventas</h1><p>Registra y revisa las ventas de tu negocio.</p></div><button className="primary-button" onClick={() => setSaleOpen(true)}><Plus size={20} /> Nueva venta</button></div>
              <div className="summary-grid three"><StatCard icon={CircleDollarSign} label="Ventas de hoy" value={formatMoney(salesToday)} detail="Total acumulado hoy" /><StatCard icon={CalendarDays} label="Ventas de la semana" value={formatMoney(weeklySales)} detail={`${progress}% de la meta semanal`} tone="blue" /><StatCard icon={ReceiptText} label="Operaciones vigentes" value={String(completedSales.length)} detail={`${sales.filter((sale) => sale.status === "voided").length} anuladas`} tone="amber" /></div>
              <article className="panel table-panel sales-history-panel"><div className="panel-title"><div><span className="icon-badge green"><ReceiptText size={21} /></span><div><h3>Historial de ventas</h3><p>Las anulaciones conservan su trazabilidad y devuelven el stock.</p></div></div></div>{commerceLoading ? <EmptyState icon={ReceiptText} title="Cargando ventas" text="Estamos recuperando el historial." /> : sales.length ? <div className="responsive-table"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Productos</th><th>Medio de pago</th><th>Estado</th><th>Total</th><th>Acción</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id} className={sale.status === "voided" ? "voided-row" : ""}><td><b>#{String(sale.id).slice(-6)}</b>{sale.voidReason && <small className="block-note">{sale.voidReason}</small>}</td><td>{new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(sale.date))}</td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} unidades</td><td><span className="status-pill neutral">{sale.payment}</span></td><td><span className={`status-pill ${sale.status === "voided" ? "danger" : "success"}`}>{sale.status === "voided" ? "Anulada" : "Vigente"}</span></td><td><b>{formatMoney(saleTotal(sale))}</b></td><td>{sale.status !== "voided" ? <button className="small-action secondary" onClick={() => setSaleToVoid(sale)}>Anular</button> : <span className="muted-action">Sin efecto</span>}</td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingCart} title="Todavía no hay ventas" text="Registra la primera venta para comenzar el historial y los cálculos financieros." />}</article>
            </>
          )}

          {view === "caja" && (
            <CashOperationsView
              closures={cashClosures}
              today={today}
              todayCashSales={cashSalesToday}
              loading={commerceLoading}
              formatMoney={formatMoney}
              onCloseCash={() => setCashCloseOpen(true)}
            />
          )}

          {view === "inventario" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">PRODUCTOS</span><h1>Inventario</h1><p>Controla el stock y evita quedarte sin productos.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => setProductImportOpen(true)}><FileSpreadsheet size={19} /> Importar Excel</button><button className="primary-button" onClick={() => { setEditingProduct(null); setProductOpen(true); }}><PackagePlus size={20} /> Agregar producto</button></div></div>
              <div className="summary-grid three"><StatCard icon={Package} label="Total de productos" value={String(products.length)} detail="Productos activos" /><StatCard icon={AlertTriangle} label="Stock bajo" value={String(lowStock.length)} detail="Necesitan reposición" tone="amber" /><StatCard icon={CalendarDays} label="Próximos a vencer" value={String(expiringSoon.length)} detail="Dentro de 7 días" tone="blue" /></div>
              <article className="panel inventory-panel"><div className="inventory-toolbar"><div className="input-wrap standalone"><Search size={19} /><input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="Buscar producto o código..." /></div><div className="filter-row">{(["Todos", "Stock bajo", "Por vencer"] as const).map((filter) => <button key={filter} className={inventoryFilter === filter ? "active" : ""} onClick={() => setInventoryFilter(filter)}>{filter}{filter === "Stock bajo" && <span>{lowStock.length}</span>}</button>)}</div></div>
                <div className="responsive-table inventory-table"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Precio venta</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredInventory.map((product) => { const critical = product.stock <= product.minStock; return <tr key={product.id}><td><div className="product-cell"><span className={`product-mini-icon ${critical ? "warning" : ""}`}><Package size={18} /></span><div><strong>{product.name}</strong><small>{product.barcode || "Sin código"}</small></div></div></td><td>{categoryDisplayName(product.category)}</td><td><b>{formatMoney(product.price)}</b><small className="block-note">Costo {formatMoney(product.cost)}</small></td><td><b>{product.stock}</b> unidades</td><td><span className={`status-pill ${critical ? "danger" : "success"}`}>{critical ? "Stock bajo" : "En orden"}</span></td><td><div className="table-actions"><button className="small-action secondary" onClick={() => { setEditingProduct(product); setProductOpen(true); }}>Editar</button><button className="small-action" disabled={productBusy === product.id} onClick={() => setProductToAdjust(product)}><Scale size={15} /> {productBusy === product.id ? "Guardando..." : "Ajustar"}</button></div></td></tr>; })}</tbody></table>{productsLoading ? <EmptyState icon={Package} title="Cargando inventario" text="Estamos recuperando los productos de tu negocio." /> : filteredInventory.length === 0 && <EmptyState icon={products.length ? Search : PackagePlus} title={products.length ? "No encontramos productos" : "Tu inventario está vacío"} text={products.length ? "Prueba otra búsqueda o cambia el filtro." : "Agrega tu primer producto para comenzar a controlar el stock."} />}</div>
              </article>
              <article className="panel table-panel inventory-movement-panel"><div className="panel-title"><div><span className="icon-badge blue"><Scale size={21} /></span><div><h3>Últimos ajustes de stock</h3><p>Ingresos, ventas, mermas y correcciones con su motivo.</p></div></div></div>{inventoryMovements.length ? <div className="responsive-table"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Cantidad</th><th>Motivo</th></tr></thead><tbody>{inventoryMovements.slice(0, 20).map((movement) => { const inbound = movement.movementType === "in" || movement.movementType === "adjustment_in"; const product = products.find((item) => item.id === movement.productId); return <tr key={movement.id}><td>{new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(movement.createdAt))}</td><td><b>{product?.name || "Producto"}</b></td><td><span className={`status-pill ${inbound ? "success" : "danger"}`}>{inbound ? "Ingreso" : "Salida"}</span></td><td><b className={inbound ? "movement-in" : "movement-out"}>{inbound ? "+" : "−"}{movement.quantity}</b></td><td>{movement.reason}</td></tr>; })}</tbody></table></div> : <EmptyState icon={Scale} title="Aún no hay movimientos" text="Las ventas, reposiciones y ajustes quedarán registrados aquí." />}</article>
            </>
          )}

          {view === "finanzas" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">RESULTADOS DEL MES</span><h1>Finanzas simples</h1><p>Entiende qué entra, qué sale y cuánto queda.</p></div><button className="primary-button" onClick={() => setExpenseOpen(true)}><Plus size={20} /> Registrar gasto</button></div>
              <div className="summary-grid four"><StatCard icon={CircleDollarSign} label="Ventas del mes" value={formatMoney(monthSales)} detail={`${salesThisMonth.length} operaciones`} /><StatCard icon={ShoppingCart} label="Costo de productos" value={formatMoney(monthCost)} detail="Mercadería vendida" tone="blue" /><StatCard icon={WalletCards} label="Gastos del mes" value={formatMoney(monthExpenses)} detail={`${expensesThisMonth.length} gastos registrados`} tone="amber" /><StatCard icon={TrendingUp} label="Resultado estimado" value={formatMoney(estimatedResult)} detail="Antes de impuestos" /></div>
              <div className="finance-insights">
                <article><span>Ticket promedio</span><strong>{formatMoney(averageTicket)}</strong><small>Promedio por venta del mes</small></article>
                <article><span>Margen bruto</span><strong>{grossMarginRate}%</strong><small>Ventas menos costo de productos</small></article>
                <article><span>Utilidad bruta</span><strong>{formatMoney(grossProfit)}</strong><small>Antes de gastos del negocio</small></article>
              </div>
              <div className="finance-grid"><article className="panel result-panel"><div className="panel-title"><div><span className="icon-badge green"><BarChart3 size={21} /></span><div><span className="eyebrow">RESUMEN DEL MES</span><h3>Así se forma tu resultado</h3></div></div></div><div className="result-formula"><div><span>Ventas reales</span><b>{formatMoney(monthSales)}</b></div><div><span>− Costo de productos vendidos</span><b>{formatMoney(monthCost)}</b></div><div className="subtotal"><span>= Utilidad bruta estimada</span><b>{formatMoney(grossProfit)}</b></div><div><span>− Gastos registrados</span><b>{formatMoney(monthExpenses)}</b></div><div className="total"><span>Resultado estimado</span><strong>{formatMoney(estimatedResult)}</strong></div></div><p className="info-note"><Lightbulb size={18} /> Se calcula solo con las ventas y gastos guardados por tu negocio. No reemplaza la contabilidad tributaria.</p></article>
                <article className="panel"><div className="panel-title"><div><span className="icon-badge blue"><WalletCards size={21} /></span><div><span className="eyebrow">SALIDAS</span><h3>Últimos gastos</h3></div></div><button className="text-button" onClick={() => setExpenseOpen(true)}>Agregar</button></div>{commerceLoading ? <EmptyState icon={WalletCards} title="Cargando gastos" text="Estamos recuperando las salidas del negocio." /> : expenses.length ? expenses.slice(0, 8).map((expense) => <div className="recent-row" key={expense.id}><span className="product-mini-icon"><ReceiptText size={17} /></span><div><strong>{expense.label}</strong><small>{expense.category ? `${expense.category} · ` : ""}{new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" }).format(new Date(expense.date))}</small></div><b>− {formatMoney(expense.amount)}</b></div>) : <EmptyState icon={WalletCards} title="Aún no hay gastos" text="Registra luz, arriendo, internet u otras salidas para estimar el resultado." />}</article></div>
              <div className="finance-analytics-grid">
                <article className="panel">
                  <div className="panel-title"><div><span className="icon-badge green"><BarChart3 size={21} /></span><div><span className="eyebrow">ÚLTIMOS 7 DÍAS</span><h3>Ventas diarias</h3><p>Solo movimientos registrados en tu cuenta.</p></div></div></div>
                  {highestDailySale > 0 ? <div className="sales-week-chart">{dailySales.map((day) => <div key={day.key}><div><b>{day.total ? formatMoney(day.total) : "$0"}</b><i style={{ "--height": `${Math.max(5, Math.round((day.total / highestDailySale) * 100))}%` } as React.CSSProperties} /></div><span>{day.label}</span></div>)}</div> : <EmptyState icon={BarChart3} title="Aún no hay ventas esta semana" text="El gráfico se completará automáticamente con tus próximas ventas." />}
                </article>
                <article className="panel">
                  <div className="panel-title"><div><span className="icon-badge blue"><CreditCard size={21} /></span><div><span className="eyebrow">MEDIOS DE PAGO</span><h3>Ventas del mes</h3><p>Distribución según lo registrado.</p></div></div></div>
                  {monthSales > 0 ? <div className="payment-breakdown">{paymentBreakdown.map((item) => <div key={item.method}><div><span>{item.method}</span><b>{formatMoney(item.total)}</b></div><div className="payment-bar"><i style={{ width: `${highestPaymentTotal ? (item.total / highestPaymentTotal) * 100 : 0}%` }} /></div><small>{item.count} {item.count === 1 ? "venta" : "ventas"}</small></div>)}</div> : <EmptyState icon={CreditCard} title="Sin medios de pago todavía" text="Aparecerán cuando registres ventas durante el mes." />}
                </article>
              </div>
            </>
          )}

          {view === "promociones" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">OPORTUNIDADES</span><h1>Promociones sugeridas</h1><p>Ideas simples para vender más y reducir pérdidas.</p></div></div>
              <div className="promotion-source-note"><CheckCircle2 size={18} /><span>Estas sugerencias se calculan con tus precios, stock, vencimientos y ventas reales. No contienen datos de maqueta.</span></div>
              <div className="promo-grid">{comboProducts && <article className="promo-card featured"><div className="promo-illustration">🥤 <Plus size={22} /> 🍿</div><span className="status-pill success">Combo con tu inventario</span><h2>{comboProducts[0].name} + {comboProducts[1].name}</h2><p>Precio orientativo con 10% de descuento sobre los precios actuales. Revisa que conserve un margen conveniente antes de ofrecerlo.</p><div className="promo-price"><span>Precio sugerido</span><strong>{formatMoney(comboPrice)}</strong></div><button className="outline-button full" onClick={() => reviewProduct(comboProducts[0].name)}>Revisar productos</button></article>}
                {expiringSoon.slice(0, 2).map((product) => <article className="promo-card" key={product.id}><span className="promo-icon amber"><CalendarDays size={28} /></span><span className="status-pill warning">Próximo a vencer</span><h2>Descuento en {product.name}</h2><p>Quedan {product.stock} unidades. Un descuento de 10% puede ayudar a venderlas antes del vencimiento.</p><div className="promo-price"><span>Precio orientativo</span><strong>{formatMoney(product.price * 0.9)}</strong></div><button className="outline-button full" onClick={() => reviewProduct(product.name)}>Revisar producto</button></article>)}
                {topSellingProduct && topSellingInventoryProduct ? <article className="promo-card"><span className="promo-icon blue"><TrendingUp size={28} /></span><span className="status-pill neutral">Más vendido en 30 días</span><h2>Destaca {topSellingProduct.name}</h2><p>Registró {topSellingProduct.units} unidades y {formatMoney(topSellingProduct.revenue)} en ventas. Mantenlo visible y con stock suficiente.</p><div className="promo-price"><span>Stock disponible</span><strong>{topSellingInventoryProduct.stock} unidades</strong></div><button className="outline-button full" onClick={() => reviewProduct(topSellingProduct.name)}>Revisar producto</button></article> : bestMarginProduct && <article className="promo-card"><span className="promo-icon blue"><TrendingUp size={28} /></span><span className="status-pill neutral">Buen margen</span><h2>Destaca {bestMarginProduct.name}</h2><p>Este producto tiene el mejor margen unitario positivo de tu inventario actual.</p><div className="promo-price"><span>Margen por unidad</span><strong>{formatMoney(bestMarginProduct.price - bestMarginProduct.cost)}</strong></div><button className="outline-button full" onClick={() => reviewProduct(bestMarginProduct.name)}>Revisar producto</button></article>}{!comboProducts && !expiringSoon.length && !topSellingProduct && !bestMarginProduct && <article className="panel promo-empty"><EmptyState icon={Tag} title="Aún no hay promociones sugeridas" text="Las ideas aparecerán al agregar productos, precios, stock, ventas y vencimientos reales." /></article>}</div>
            </>
          )}

          {view === "reportes" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">DATOS PARA DECIDIR</span><h1>Reportes</h1><p>Revisa un periodo y descarga información real de tu negocio.</p></div><button className="primary-button" onClick={exportSummary}><Download size={20} /> Descargar resumen</button></div>
              <article className="panel report-filter-panel">
                <div><span className="icon-badge green"><CalendarDays size={22} /></span><div><h2>Periodo del reporte</h2><p>Las ventas y gastos consideran ambas fechas.</p></div></div>
                <label>Desde<input type="date" value={reportFrom} max={reportTo} onChange={(event) => setReportFrom(event.target.value)} /></label>
                <label>Hasta<input type="date" value={reportTo} min={reportFrom} max={localDateKey()} onChange={(event) => setReportTo(event.target.value)} /></label>
              </article>
              <div className="summary-grid four report-summary"><StatCard icon={CircleDollarSign} label="Ventas del periodo" value={formatMoney(reportRevenue)} detail={`${reportSales.length} operaciones`} /><StatCard icon={ShoppingCart} label="Costo de productos" value={formatMoney(reportCost)} detail="Costo histórico vendido" tone="blue" /><StatCard icon={WalletCards} label="Gastos del periodo" value={formatMoney(reportExpenseTotal)} detail={`${reportExpenses.length} registros`} tone="amber" /><StatCard icon={TrendingUp} label="Resultado estimado" value={formatMoney(reportResult)} detail="Antes de impuestos" /></div>
              <div className="report-download-grid">
                <article className="panel report-download-card"><span className="icon-badge green large"><ShoppingCart size={25} /></span><div><h2>Ventas detalladas</h2><p>Cada producto vendido, cantidad, precio, costo, medio de pago y utilidad bruta.</p></div><strong>{reportSales.length} ventas</strong><button className="outline-button full" disabled={!reportSales.length} onClick={exportSales}><Download size={18} /> Descargar ventas</button></article>
                <article className="panel report-download-card"><span className="icon-badge blue large"><Package size={25} /></span><div><h2>Inventario actual</h2><p>Códigos, categorías, precios, stock, vencimientos y valorización a costo.</p></div><strong>{products.length} productos</strong><button className="outline-button full" disabled={!products.length} onClick={exportInventory}><Download size={18} /> Descargar inventario</button></article>
                <article className="panel report-download-card"><span className="icon-badge amber large"><WalletCards size={25} /></span><div><h2>Gastos detallados</h2><p>Fecha, descripción, categoría y monto de cada salida registrada.</p></div><strong>{reportExpenses.length} gastos</strong><button className="outline-button full" disabled={!reportExpenses.length} onClick={exportExpenses}><Download size={18} /> Descargar gastos</button></article>
              </div>
              <article className="panel report-ranking-panel">
                <div className="panel-title"><div><span className="icon-badge blue"><TrendingUp size={21} /></span><div><span className="eyebrow">PRODUCTOS DEL PERIODO</span><h3>Los que más se vendieron</h3></div></div></div>
                {reportProductPerformance.length ? <div className="responsive-table"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ventas</th><th>Utilidad bruta</th></tr></thead><tbody>{reportProductPerformance.slice(0, 10).map((product) => <tr key={product.name}><td><b>{product.name}</b></td><td>{product.units}</td><td>{formatMoney(product.revenue)}</td><td><b>{formatMoney(product.profit)}</b></td></tr>)}</tbody></table></div> : <EmptyState icon={FileSpreadsheet} title="Sin ventas en este periodo" text="Cambia las fechas o registra ventas para completar el reporte." />}
              </article>
              <p className="info-note report-note"><Lightbulb size={18} /> Los archivos se descargan en formato CSV compatible con Excel. Los resultados son de gestión y no reemplazan la contabilidad tributaria.</p>
            </>
          )}

          {view === "metas" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">OBJETIVOS</span><h1>Mi meta semanal</h1><p>Define un objetivo claro y sigue tu avance cada día.</p></div></div>
              <div className="goals-layout"><article className="panel large-goal"><div className="progress-ring big" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>completado</span></div></div><div><span className="eyebrow">ESTA SEMANA</span><h2>{formatMoney(weeklySales)}</h2><p>de una meta de {formatMoney(weeklyGoal)}</p><div className="goal-message"><TrendingUp size={18} /> {missingGoal ? <>Te faltan <b>{formatMoney(missingGoal)}</b></> : <b>¡Meta superada!</b>}</div></div></article><article className="panel goal-editor"><span className="icon-badge green"><Target size={23} /></span><h2>Edita tu meta</h2><p>La cifra quedará guardada en tu cuenta y se verá igual desde el teléfono y el computador.</p><label>Monto de la meta semanal<span className="money-input">$ <input type="number" min="10000" step="10000" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Number(event.target.value))} /></span></label><button className="primary-button full" disabled={profileBusy} onClick={() => void persistWeeklyGoal()}><Check size={19} /> {profileBusy ? "Guardando…" : "Guardar meta"}</button></article></div>
            </>
          )}

          {view === "configuracion" && (
            <>
              <div className="page-heading"><div><span className="eyebrow">PREFERENCIAS</span><h1>Configuración</h1><p>Administra los datos básicos de tu negocio.</p></div></div>
              <div className="settings-grid">
                <article className="panel settings-card">
                  <span className="icon-badge green large"><Store size={27} /></span>
                  <div><h2>Datos del negocio</h2><p>Mantén actualizada la información de tu local.</p></div>
                  <label>Nombre del negocio<input value={identity.businessName} onChange={(event) => setIdentity((current) => ({ ...current, businessName: event.target.value }))} /></label>
                  <label>Tipo de negocio<select value={identity.businessType} onChange={(event) => setIdentity((current) => ({ ...current, businessType: event.target.value }))}><option>Minimarket</option><option>Almacén</option><option>Botillería</option><option>Bazar</option><option>Panadería</option><option>Confitería</option><option>Verdulería</option><option>Otro comercio</option></select></label>
                  <label>RUT del negocio<input value={identity.rut} onChange={(event) => setIdentity((current) => ({ ...current, rut: event.target.value }))} placeholder="76.123.456-7" /></label>
                  <label>Nombre de la persona administradora<input value={identity.fullName} onChange={(event) => setIdentity((current) => ({ ...current, fullName: event.target.value }))} /></label>
                  <label>Teléfono<input type="tel" value={identity.phone} onChange={(event) => setIdentity((current) => ({ ...current, phone: event.target.value }))} placeholder="+56 9 1234 5678" /></label>
                </article>
                <article className="panel settings-card">
                  <span className="icon-badge blue large"><CheckCircle2 size={27} /></span>
                  <div><h2>Ubicación y sincronización</h2><p>Estos datos y tu meta semanal quedan asociados al minimarket.</p></div>
                  <label>Dirección<input value={identity.address} onChange={(event) => setIdentity((current) => ({ ...current, address: event.target.value }))} placeholder="Calle y número" /></label>
                  <label>Comuna<input value={identity.commune} onChange={(event) => setIdentity((current) => ({ ...current, commune: event.target.value }))} placeholder="Ej: Ñuñoa" /></label>
                  <label>Región<select value={identity.region} onChange={(event) => setIdentity((current) => ({ ...current, region: event.target.value }))}><option>Arica y Parinacota</option><option>Tarapacá</option><option>Antofagasta</option><option>Atacama</option><option>Coquimbo</option><option>Valparaíso</option><option>Metropolitana</option><option>O’Higgins</option><option>Maule</option><option>Ñuble</option><option>Biobío</option><option>La Araucanía</option><option>Los Ríos</option><option>Los Lagos</option><option>Aysén</option><option>Magallanes</option></select></label>
                  <button className="primary-button full" disabled={profileBusy} onClick={() => void persistBusinessProfile("Datos del negocio actualizados")}><Check size={19} /> {profileBusy ? "Guardando…" : "Guardar cambios"}</button>
                  <hr />
                  <button className="danger-button" onClick={logout}><LogOut size={18} /> Cerrar sesión</button>
                </article>
                <article className="panel settings-card">
                  <span className="icon-badge blue large"><UserPlus size={27} /></span>
                  <div><h2>Equipo del negocio</h2><p>Asocia una cuenta existente como administrador o vendedor.</p></div>
                  <form className="embedded-form" onSubmit={(event) => void saveTeamMember(event)}>
                    <label>Correo del usuario<input name="memberEmail" type="email" required placeholder="persona@correo.cl" /></label>
                    <label>Rol<select name="memberRole" defaultValue="seller"><option value="seller">Vendedor/a</option><option value="manager">Administrador/a</option></select></label>
                    <button className="outline-button full" disabled={profileBusy}><UserPlus size={18} /> Asociar usuario</button>
                  </form>
                  <p className="block-note">La persona debe crear primero su cuenta en Mi Boliche. El administrador gestiona el negocio; el vendedor opera ventas e inventario.</p>
                </article>
                <article className="panel settings-card">
                  <span className="icon-badge amber large"><Headphones size={27} /></span>
                  <div><h2>Soporte técnico</h2><p>Envía una solicitud que aparecerá en el Panel del propietario.</p></div>
                  <form className="embedded-form" onSubmit={(event) => void sendSupportTicket(event)}>
                    <label>Asunto<input name="ticketSubject" required minLength={4} maxLength={120} placeholder="Ej: No puedo registrar una venta" /></label>
                    <label>Prioridad<select name="ticketPriority" defaultValue="medium"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
                    <label>Descripción<textarea name="ticketDescription" required minLength={10} maxLength={3000} placeholder="Describe qué ocurrió y qué estabas intentando hacer." /></label>
                    <button className="primary-button full" disabled={profileBusy}><Headphones size={18} /> Enviar solicitud</button>
                  </form>
                </article>
                <article className="panel settings-card">
                  <span className="icon-badge green large"><Scale size={27} /></span>
                  <div><h2>Privacidad y condiciones</h2><p>Consulta cómo protegemos tus datos y cuáles son las reglas del servicio.</p></div>
                  <button className="outline-button full" onClick={() => setLegalDocument("terms")}><Scale size={18} /> Ver términos de uso</button>
                  <button className="outline-button full" onClick={() => setLegalDocument("privacy")}><ShieldCheck size={18} /> Ver política de privacidad</button>
                  <p className="block-note">Versión actualizada el 30 de julio de 2026.</p>
                </article>
              </div>
            </>
          )}
        </section>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navegación móvil">{navItems.slice(0, 4).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={21} /><span>{item.label}</span></button>)}<button className={mobileMenu ? "active" : ""} onClick={() => setMobileMenu(true)}><Menu size={21} /><span>Más</span></button></nav>

      {mobileMenu && <div className="mobile-drawer-backdrop" onClick={() => setMobileMenu(false)}><aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><Logo /><button className="icon-button" onClick={() => setMobileMenu(false)}><X size={22} /></button></div><div className="business-pill"><span>{businessInitials}</span><div><strong>{identity.businessName}</strong><small>Minimarket</small></div></div><nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} />{item.label}</button>)}<button onClick={() => navigate("configuracion")}><Settings size={20} />Configuración</button><button onClick={logout}><LogOut size={20} />Cerrar sesión</button></nav></aside></div>}

      {saleOpen && <div className="modal-backdrop" onMouseDown={() => { if (!commerceBusy) setSaleOpen(false); }}><section className="modal sale-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">VENTA RÁPIDA</span><h2>Ingresar venta</h2></div><button className="icon-button" disabled={commerceBusy} onClick={() => setSaleOpen(false)}><X size={23} /></button></div><div className="sale-layout"><div className="product-picker"><div className="input-wrap standalone"><Search size={19} /><input autoFocus value={saleQuery} onChange={(event) => setSaleQuery(event.target.value)} placeholder="Producto o código de barras..." /><ScanLine size={19} /></div><div className="picker-list">{products.filter((product) => product.name.toLowerCase().includes(saleQuery.toLowerCase()) || product.barcode.includes(saleQuery)).map((product) => <button key={product.id} onClick={() => updateDraft(product.id, 1)} disabled={product.stock === 0}><span className="product-mini-icon"><Package size={18} /></span><div><strong>{product.name}</strong><small>{product.stock} disponibles · {formatMoney(product.price)}</small></div><Plus size={19} /></button>)}</div></div><div className="cart-panel"><div className="cart-title"><h3><ShoppingCart size={20} /> Venta actual</h3><span>{draftItems.reduce((sum, item) => sum + item.quantity, 0)} productos</span></div><div className="cart-items">{draftItems.length === 0 ? <EmptyState icon={ShoppingCart} title="Tu venta está vacía" text="Selecciona productos para agregarlos." /> : draftItems.map(({ product, quantity }) => <div className="cart-row" key={product.id}><div><strong>{product.name}</strong><small>{formatMoney(product.price)} c/u</small></div><div className="quantity-control"><button onClick={() => updateDraft(product.id, -1)}><Minus size={15} /></button><b>{quantity}</b><button onClick={() => updateDraft(product.id, 1)}><Plus size={15} /></button></div><b>{formatMoney(product.price * quantity)}</b></div>)}</div><div className="payment-options"><span>Medio de pago</span><div>{(["Efectivo", "Tarjeta", "Transferencia"] as const).map((method) => <button key={method} className={payment === method ? "active" : ""} onClick={() => setPayment(method)}>{method === "Efectivo" ? <CircleDollarSign size={17} /> : method === "Tarjeta" ? <CreditCard size={17} /> : <Landmark size={17} />}{method}</button>)}</div></div><div className="cart-total"><span>Total</span><strong>{formatMoney(draftTotal)}</strong></div><button className="primary-button full" disabled={!draftItems.length || commerceBusy} onClick={() => void confirmSale()}><CheckCircle2 size={20} /> {commerceBusy ? "Registrando…" : "Confirmar venta"}</button></div></div></section></div>}

      {productOpen && <ProductEditor key={editingProduct?.id || "new-product"} busy={Boolean(productBusy)} existingProducts={products} product={editingProduct} onClose={() => { setProductOpen(false); setEditingProduct(null); }} onCreate={addProduct} onUpdate={saveProductChanges} onEditExisting={(product) => { setEditingProduct(product); setProductOpen(true); }} />}
      {productImportOpen && <ProductImportModal busy={productBusy === "bulk-import"} existingProducts={products} onClose={() => setProductImportOpen(false)} onImport={bulkImportProducts} />}
      {legalDocument && <LegalDocument type={legalDocument} onClose={() => setLegalDocument(null)} />}

      {expenseOpen && <div className="modal-backdrop" onMouseDown={() => { if (!commerceBusy) setExpenseOpen(false); }}><section className="modal tiny-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">FINANZAS</span><h2>Registrar gasto</h2></div><button className="icon-button" disabled={commerceBusy} onClick={() => setExpenseOpen(false)}><X size={23} /></button></div><form className="stack-form" onSubmit={(event) => void addExpense(event)}><label>Descripción<input name="label" placeholder="Ej: Cuenta de luz" required /></label><label>Categoría<select name="category" defaultValue="Servicios"><option>Servicios</option><option>Arriendo</option><option>Mercadería</option><option>Transporte</option><option>Personal</option><option>Mantención</option><option>Impuestos</option><option>Otros</option></select></label><label>Monto<span className="money-input">$ <input name="amount" type="number" min="1" placeholder="0" required /></span></label><button className="primary-button full" type="submit" disabled={commerceBusy}><Check size={19} /> {commerceBusy ? "Guardando…" : "Guardar gasto"}</button></form></section></div>}

      {cashCloseOpen && <CashCloseModal current={cashClosures.find((closure) => closure.businessDate === today)} today={today} todayCashSales={cashSalesToday} busy={commerceBusy} formatMoney={formatMoney} onClose={() => setCashCloseOpen(false)} onSubmit={saveCashClosure} />}

      {saleToVoid && <VoidSaleModal sale={saleToVoid} busy={commerceBusy} formatMoney={formatMoney} onClose={() => setSaleToVoid(null)} onConfirm={confirmVoidSale} />}

      {productToAdjust && <StockAdjustmentModal product={productToAdjust} busy={productBusy === productToAdjust.id} onClose={() => setProductToAdjust(null)} onConfirm={adjustProduct} />}

      {toast && <div className="toast"><CheckCircle2 size={20} /> {toast}</div>}
    </div>
  );
}
