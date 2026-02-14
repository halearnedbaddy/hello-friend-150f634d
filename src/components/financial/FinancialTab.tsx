import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileText,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  CreditCard,
} from "lucide-react";
import { api } from "@/services/api";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";

type FinancialSubTab = "dashboard" | "expenses" | "profit-loss" | "tax" | "payment-options" | "health";

const EXPENSE_CATEGORIES = [
  "shipping",
  "marketing",
  "supplies",
  "software",
  "inventory",
  "other",
];

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  vendor_name?: string;
  expense_date: string;
  is_tax_deductible?: boolean;
  created_at: string;
}

export function FinancialTab({ initialSubTab = "dashboard" }: { initialSubTab?: FinancialSubTab }) {
  const { formatPrice } = useCurrency();
  const [subTab, setSubTab] = useState<FinancialSubTab>(initialSubTab);
  const [period, setPeriod] = useState("30d");
  const [dashboard, setDashboard] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensePagination, setExpensePagination] = useState({ page: 1, pages: 1 });
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [taxReport, setTaxReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "other",
    description: "",
    vendor_name: "",
    expense_date: new Date().toISOString().slice(0, 10),
    is_tax_deductible: true,
  });
  const [saving, setSaving] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    const res = await api.getFinancialDashboard?.(period);
    setLoading(false);
    if (res?.success && res.data) setDashboard(res.data);
  };

  const loadExpenses = async () => {
    setLoading(true);
    const res = await api.getFinancialExpenses?.({ page: expensePagination.page, limit: 20 });
    setLoading(false);
    if (res?.success && res.data) {
      setExpenses(res.data.expenses || []);
      setExpensePagination((p) => ({ ...p, ...res.data.pagination }));
    }
  };

  const loadProfitLoss = async () => {
    setLoading(true);
    const end = new Date();
    const start = new Date(Date.now() - 30 * 86400000);
    const res = await api.getProfitLossReport?.({
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    });
    setLoading(false);
    if (res?.success && res.data) setProfitLoss(res.data);
  };

  const loadTaxReport = async () => {
    setLoading(true);
    const res = await api.getTaxReport?.({ year: new Date().getFullYear() });
    setLoading(false);
    if (res?.success && res.data) setTaxReport(res.data);
  };

  useEffect(() => {
    if (subTab === "dashboard") loadDashboard();
    else if (subTab === "expenses") loadExpenses();
    else if (subTab === "profit-loss") loadProfitLoss();
    else if (subTab === "tax") loadTaxReport();
  }, [subTab, period, expensePagination.page]);

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.category || !expenseForm.description || !expenseForm.expense_date) return;
    setSaving(true);
    const res = await api.createExpense?.({
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description,
      vendor_name: expenseForm.vendor_name || undefined,
      expense_date: expenseForm.expense_date,
      is_tax_deductible: expenseForm.is_tax_deductible,
    });
    setSaving(false);
    if (res?.success) {
      setShowAddExpense(false);
      setExpenseForm({
        amount: "",
        category: "other",
        description: "",
        vendor_name: "",
        expense_date: new Date().toISOString().slice(0, 10),
        is_tax_deductible: true,
      });
      loadExpenses();
      loadDashboard();
    } else {
      alert(res?.error || "Failed to add expense");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    setDeletingId(id);
    await api.deleteExpense?.(id);
    setDeletingId(null);
    loadExpenses();
    loadDashboard();
  };

  const subTabs: { id: FinancialSubTab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Overview", icon: DollarSign },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "profit-loss", label: "Profit & Loss", icon: FileText },
    { id: "tax", label: "Tax Report", icon: FileText },
    { id: "payment-options", label: "Payment Options", icon: CreditCard },
    { id: "health", label: "Financial Health", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Financial</h2>
        <div className="flex gap-2 flex-wrap">
          {subTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
                  subTab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === "dashboard" && (
        <>
          <div className="flex gap-2">
            {["7d", "30d", "90d", "1y"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium",
                  period === p ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
              >
                {p === "7d" ? "7 days" : p === "30d" ? "30 days" : p === "90d" ? "90 days" : "1 year"}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard?.summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPrice(dashboard.summary.revenue, "KES")}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatPrice(dashboard.summary.expenses, "KES")}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Commission</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatPrice(dashboard.summary.commission, "KES")}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-2xl font-bold">
                  {formatPrice(dashboard.summary.net_profit, "KES")}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No financial data yet.
            </div>
          )}
        </>
      )}

      {subTab === "expenses" && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Expenses</h3>
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <Plus size={18} />
              Add Expense
            </button>
          </div>
          {showAddExpense && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h4 className="font-semibold">New Expense</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount *</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border"
                    placeholder="What was this expense for?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor</label>
                  <input
                    type="text"
                    value={expenseForm.vendor_name}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tax"
                    checked={expenseForm.is_tax_deductible}
                    onChange={(e) => setExpenseForm({ ...expenseForm, is_tax_deductible: e.target.checked })}
                  />
                  <label htmlFor="tax" className="text-sm">Tax deductible</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddExpense}
                  disabled={saving || !expenseForm.amount || !expenseForm.description}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 bg-muted rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No expenses yet. Add expenses to track your business costs.
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
                >
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.category} • {e.expense_date} {e.vendor_name && `• ${e.vendor_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600">
                      -{formatPrice(e.amount, "KES")}
                    </span>
                    <button
                      onClick={() => handleDeleteExpense(e.id)}
                      disabled={deletingId === e.id}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      {deletingId === e.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expensePagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setExpensePagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={expensePagination.page <= 1}
                className="px-4 py-2 rounded-lg border disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {expensePagination.page} of {expensePagination.pages}
              </span>
              <button
                onClick={() => setExpensePagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={expensePagination.page >= expensePagination.pages}
                className="px-4 py-2 rounded-lg border disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {subTab === "profit-loss" && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : profitLoss ? (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <h3 className="text-lg font-semibold">
                Profit & Loss • {profitLoss.period?.start} to {profitLoss.period?.end}
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Revenue</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Sales</span>
                      <span className="font-medium">{formatPrice(profitLoss.revenue?.gross_sales ?? 0, "KES")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Refunds</span>
                      <span className="text-red-600">-{formatPrice(profitLoss.revenue?.refunds ?? 0, "KES")}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Net Sales</span>
                      <span>{formatPrice(profitLoss.revenue?.net_sales ?? 0, "KES")}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Expenses</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Commission</span>
                      <span>{formatPrice(profitLoss.expenses?.platform_commission ?? 0, "KES")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Operating</span>
                      <span>{formatPrice(profitLoss.expenses?.operating_expenses ?? 0, "KES")}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total Expenses</span>
                      <span className="text-red-600">
                        {formatPrice(profitLoss.expenses?.total_expenses ?? 0, "KES")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <span className="text-lg font-semibold">Net Profit</span>
                <span className="text-2xl font-bold">
                  {formatPrice(profitLoss.net_profit ?? 0, "KES")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Profit margin: {profitLoss.profit_margin ?? 0}%
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No data for profit & loss report.
            </div>
          )}
        </>
      )}

      {subTab === "tax" && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : taxReport ? (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold">
                Tax Report • {taxReport.year} {taxReport.quarter ? `Q${taxReport.quarter}` : "Annual"}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Total Sales</span>
                  <span className="font-medium">{formatPrice(taxReport.total_sales ?? 0, "KES")}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Total Refunds</span>
                  <span className="text-red-600">-{formatPrice(taxReport.total_refunds ?? 0, "KES")}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Total Expenses</span>
                  <span className="text-red-600">-{formatPrice(taxReport.total_expenses ?? 0, "KES")}</span>
                </div>
                <div className="flex justify-between p-4 bg-primary/10 rounded-lg font-semibold">
                  <span>Taxable Income</span>
                  <span>{formatPrice(taxReport.taxable_income ?? 0, "KES")}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                This is a summary for your records. Consult a tax professional for filing.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No tax data yet.
            </div>
          )}
        </>
      )}

      {(subTab === "payment-options" || subTab === "health") && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-2">
            {subTab === "payment-options"
              ? "Manage your payout methods in the main PayLoom Dashboard → Wallet."
              : "Financial health insights coming soon."}
          </p>
          <p className="text-sm text-muted-foreground">
            Your wallet and payout methods are configured in the seller dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
