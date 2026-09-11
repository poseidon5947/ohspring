"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Account, Row, api } from "@/lib/api";
import { fields, statuses, Field } from "@/lib/modules";
import Header from "./Header";
type Data = Record<string, Row[]>;
const workspaceEmblems = [
  "/brand/emblems/tracked-requests-v1.webp",
  "/brand/emblems/remote-response-v1.webp",
  "/brand/emblems/field-coordination-v1.webp",
  "/brand/emblems/visible-progress-v1.webp",
  "/brand/emblems/journey-understand-v1.webp",
  "/brand/emblems/journey-plan-v1.webp",
  "/brand/emblems/journey-resolve-v1.webp",
  "/brand/emblems/journey-care-v1.webp",
];
export default function Workspace() {
  const t = useTranslations(),
    locale = useLocale(),
    router = useRouter();
  const query = useSearchParams();
  const captureStarted = useRef(false);
  const [user, setUser] = useState<Account | null>(null),
    [users, setUsers] = useState<Account[]>([]),
    [data, setData] = useState<Data>({}),
    [module, setModule] = useState("overview"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [board, setBoard] = useState(true);
  const admin = user?.role === "ADMIN",
    staff = user?.role !== "CUSTOMER";
  const label = (key: string) => (t.has(key) ? t(key) : key);
  const modules =
    user?.role === "CUSTOMER"
      ? ["overview", "tickets", "invoices", "notifications"]
      : [
          "overview",
          "tickets",
          "projects",
          "tasks",
          ...(admin || user?.crmAccess ? ["leads", "interactions"] : []),
          "time",
          ...(admin ? ["employees", "invoices", "ledger", "audit"] : []),
          "notifications",
        ];
  const refresh = useCallback(async () => {
    try {
      const me = await api<Account>("/auth/me");
      setUser(me);
      const ms =
        me.role === "CUSTOMER"
          ? ["tickets", "invoices", "notifications", "replies"]
          : [
              "tickets",
              "projects",
              "tasks",
              "time",
              "notifications",
              "replies",
              ...(me.role === "ADMIN" || me.crmAccess
                ? ["leads", "interactions"]
                : []),
              ...(me.role === "ADMIN" ? ["invoices", "ledger", "audit"] : []),
            ];
      const loaded = await Promise.all(
        ms.map(async (m) => [m, await api<Row[]>(`/records/${m}`)] as const),
      );
      setData(Object.fromEntries(loaded));
      if (me.role !== "CUSTOMER") setUsers(await api<Account[]>("/users"));
    } catch (e) {
      if ((e as Error).message === "unauthorized") {
        window.dispatchEvent(new Event("ab:navigation-start"));
        router.replace(`/${locale}/login`);
      } else setNotice((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [locale, router]);
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    const invoice = query.get("paypalInvoice"),
      token = query.get("token");
    if (user && invoice && token && !captureStarted.current) {
      captureStarted.current = true;
      api(`/invoices/${invoice}/paypal-capture`, "POST", { token })
        .then(() => {
          setNotice("paymentSuccess");
          refresh();
          window.dispatchEvent(new Event("ab:navigation-start"));
          router.replace(`/${locale}/workspace`);
        })
        .catch((e) => setNotice(e.message));
    }
  }, [query, user, refresh, router, locale]);
  useEffect(() => {
    if (!creating && !selected) return;
    const previous = document.activeElement as HTMLElement;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input,select,textarea",
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreating(false);
        setSelected(null);
      }
      if (e.key === "Tab") {
        const list = focusable();
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [creating, selected]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice("saved");
      return true;
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function switchModule(m: string) {
    setModule(m);
    setSelected(null);
    setCreating(false);
    setSearch("");
    setFilter("");
    setFrom("");
    setTo("");
    setNotice("");
  }
  const rows = (data[module] || []).filter(
    (r) =>
      JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()) &&
      (!filter ||
        r.data.status === filter ||
        r.ownerId === filter ||
        r.data.service === filter) &&
      (!from || String(r.data.date || r.createdAt).slice(0, 10) >= from) &&
      (!to || String(r.data.date || r.createdAt).slice(0, 10) <= to),
  );
  const accountName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ||
    (id === user?.id ? user.name : t("unassigned"));
  const sources = (source: string): { id: string; title: string }[] =>
    source === "customers"
      ? users
          .filter((u) => u.role === "CUSTOMER")
          .map((u) => ({ id: u.id, title: u.name }))
      : source === "staff"
        ? users
            .filter((u) => u.role !== "CUSTOMER")
            .map((u) => ({ id: u.id, title: u.name }))
        : (data[source] || []).map((r) => ({
            id: r.id,
            title: String(r.data.title),
          }));
  const currentFields = [...(fields[module] || [])];
  if (module === "tickets" && staff)
    currentFields.push({ key: "customerId", source: "customers" });
  function field(f: Field) {
    return (
      <label key={f.key}>
        {label(f.key)} {f.optional && <small>({t("optional")})</small>}
        {f.options ? (
          <select name={f.key}>
            {f.options.map((o) => (
              <option value={o} key={o}>
                {label(o)}
              </option>
            ))}
          </select>
        ) : f.source ? (
          <select name={f.key} required={!f.optional} defaultValue="">
            <option value="">{t("choose")}</option>
            {sources(f.source).map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea
            name={f.key}
            rows={3}
            required={!f.optional}
            maxLength={5000}
          />
        ) : (
          <input
            name={f.key}
            type={f.type || "text"}
            required={!f.optional}
            min={f.type === "number" ? "0.01" : undefined}
            step={f.type === "number" ? "0.01" : undefined}
            minLength={f.type === "password" ? 12 : undefined}
            maxLength={f.type === "password" ? 72 : 254}
          />
        )}
      </label>
    );
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await run(() =>
        api(
          module === "employees" ? "/users" : `/records/${module}`,
          "POST",
          d,
        ),
      )
    )
      setCreating(false);
  }
  const update = (r: Row, d: Record<string, unknown>) =>
    run(() => api(`/records/${r.module}/${r.id}`, "PATCH", d));
  function exportReport() {
    const all =
      module === "employees"
        ? users.map((u) => ({ ...u }))
        : rows.map((r) => ({
            id: r.id,
            ...r.data,
            owner: accountName(r.ownerId),
            assignee: accountName(r.assigneeId),
            createdAt: r.createdAt,
          }));
    if (!all.length) return;
    const keys = Array.from(new Set(all.flatMap((x) => Object.keys(x))));
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      keys.map(cell).join(","),
      ...all.map((row) =>
        keys.map((k) => cell((row as Record<string, unknown>)[k])).join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ab-${module}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const canCreate =
    !!fields[module] &&
    (admin ||
      (!["invoices", "ledger", "employees", "projects"].includes(module) &&
        staff) ||
      module === "tickets");
  const ticketCount = (data.tickets || []).filter((r) =>
    ["open", "in_progress"].includes(String(r.data.status)),
  ).length;
  const metrics = [
    ["activeTickets", ticketCount],
    [
      "openProjects",
      (data.projects || []).filter((r) => r.data.status !== "completed").length,
    ],
    [
      "unpaidInvoices",
      (data.invoices || []).filter((r) => r.data.status !== "paid").length,
    ],
    [
      "recordedHours",
      (data.time || [])
        .reduce((a, r) => a + Number(r.data.hours || 0), 0)
        .toFixed(2),
    ],
  ];
  function summaries(items: Row[]) {
    const totals: Record<string, { income: number; expense: number }> = {};
    for (const r of items) {
      const c = String(r.data.currency);
      totals[c] ??= { income: 0, expense: 0 };
      totals[c][r.data.type === "expense" ? "expense" : "income"] += Number(
        r.data.amount,
      );
    }
    return (
      <div className="metric-grid">
        {Object.entries(totals).map(([currency, v]) => (
          <article className="metric" key={currency}>
            <span>{currency}</span>
            <strong>
              {new Intl.NumberFormat(locale, {
                style: "currency",
                currency,
              }).format(v.income - v.expense)}
            </strong>
            <small>
              {t("income")}: {v.income.toFixed(2)} · {t("expense")}:{" "}
              {v.expense.toFixed(2)}
            </small>
          </article>
        ))}
      </div>
    );
  }
  function rowCard(r: Row) {
    return (
      <article className="work-card" key={r.id}>
        <div className="card-top">
          <small>#{r.id.slice(0, 8)}</small>
          {r.data.status && (
            <span className={`badge ${r.data.status}`}>
              {label(String(r.data.status))}
            </span>
          )}
        </div>
        <button className="record-title" onClick={() => setSelected(r)}>
          {label(String(r.data.title || r.data.message || "details"))}
        </button>
        <p>
          {r.data.description
            ? String(r.data.description).slice(0, 130)
            : r.data.amount
              ? `${r.data.currency} ${r.data.amount}`
              : r.data.hours !== undefined
                ? `${Number(r.data.hours).toFixed(2)} ${t("hours")}`
                : ""}
        </p>
        <div className="record-meta">
          <span>
            {r.assigneeId
              ? accountName(r.assigneeId)
              : new Date(r.createdAt).toLocaleDateString(locale)}
          </span>
          {r.data.priority && (
            <span className={`priority ${r.data.priority}`}>
              {label(String(r.data.priority))}
            </span>
          )}
        </div>
        {statuses[r.module] && (staff || admin) && (
          <label className="compact-label">
            {t("status")}
            <select
              value={String(r.data.status)}
              disabled={busy}
              onChange={(e) => update(r, { status: e.target.value })}
            >
              {statuses[r.module].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        {r.module === "time" && r.data.status === "active" && (
          <button
            className="button small"
            disabled={busy}
            onClick={() => update(r, {})}
          >
            {t("clockOut")}
          </button>
        )}
        {r.module === "notifications" && r.data.status === "unread" && (
          <button
            className="link-button"
            disabled={busy}
            onClick={() => update(r, { status: "read" })}
          >
            {t("markRead")}
          </button>
        )}
      </article>
    );
  }
  if (loading)
    return (
      <>
        <Header />
        <main className="container section">
          <p role="status">{t("loading")}</p>
        </main>
      </>
    );
  if (!user)
    return (
      <>
        <Header />
        <main className="container section">
          <p className="error" role="alert">
            {label(notice || "unavailable")}
          </p>
          <button className="button" onClick={refresh}>
            {t("refresh")}
          </button>
        </main>
      </>
    );
  return (
    <>
      <Header />
      <div className="workspace-shell">
        <aside className="sidebar">
          <p className="eyebrow">{t("workspace")}</p>
          <div className="user-profile">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{t(user.role)}</small>
            </div>
          </div>
          <nav aria-label={t("workspace")}>
            {modules.map((m, i) => (
              <button
                key={m}
                className={module === m ? "selected" : ""}
                onClick={() => switchModule(m)}
              >
                <span className="workspace-nav-icon" aria-hidden>
                  <Image
                    src={workspaceEmblems[i % workspaceEmblems.length]}
                    alt=""
                    width={34}
                    height={34}
                  />
                </span>
                {t(m === "tickets" && !staff ? "myTickets" : m)}
                {m === "notifications" &&
                  (data.notifications || []).some(
                    (r) => r.data.status === "unread",
                  ) && <span className="red-dot" />}
              </button>
            ))}
          </nav>
          <button
            className="link-button logout"
            onClick={() =>
              run(async () => {
                await api("/auth/logout", "POST");
                window.dispatchEvent(new Event("ab:navigation-start"));
                router.push(`/${locale}/login`);
              })
            }
          >
            {t("logout")} ↗
          </button>
        </aside>
        <main className="workspace-main">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">AB SYSTEMS TECH / {t(user.role)}</p>
              <h1>
                {t(module === "tickets" && !staff ? "myTickets" : module)}
              </h1>
            </div>
            <div className="actions">
              <button
                className="button outline small"
                onClick={refresh}
                disabled={busy}
              >
                {t("refresh")}
              </button>
              {canCreate && (
                <button
                  className="button small"
                  onClick={() => {
                    setNotice("");
                    setCreating(true);
                  }}
                >
                  + {t(module === "time" ? "clockIn" : "create")}
                </button>
              )}
            </div>
          </div>
          {notice && (
            <p
              role="status"
              className={
                ["saved", "paymentSuccess"].includes(notice)
                  ? "success"
                  : "error"
              }
            >
              {label(notice)}
            </p>
          )}
          {module === "overview" ? (
            <>
              <div className="metric-grid">
                {metrics
                  .filter(
                    ([key]) =>
                      staff ||
                      ["activeTickets", "unpaidInvoices"].includes(String(key)),
                  )
                  .map(([key, value]) => (
                    <article className="metric" key={key}>
                      <span>{label(String(key))}</span>
                      <strong>{value}</strong>
                      <span className="metric-line" />
                    </article>
                  ))}
              </div>
              <div className="section-heading dashboard-section">
                <h2>{t("recent")}</h2>
                <button
                  className="link-button"
                  onClick={() => switchModule("tickets")}
                >
                  {t("tickets")} ↗
                </button>
              </div>
              <div className="record-grid">
                {(data.tickets || []).slice(0, 3).map(rowCard)}
              </div>
              {!data.tickets?.length && <Empty />}
              {admin && (
                <>
                  <h2 className="dashboard-section">{t("staffWorkload")}</h2>
                  <div className="record-grid">
                    {users
                      .filter((u) => u.role !== "CUSTOMER")
                      .map((u) => (
                        <article className="work-card" key={u.id}>
                          <h3>{u.name}</h3>
                          <p>
                            {t("tickets")}:{" "}
                            {
                              (data.tickets || []).filter(
                                (r) =>
                                  r.assigneeId === u.id &&
                                  !["closed", "resolved"].includes(
                                    String(r.data.status),
                                  ),
                              ).length
                            }
                          </p>
                          <p>
                            {t("projects")}:{" "}
                            {
                              (data.projects || []).filter(
                                (r) =>
                                  r.assigneeId === u.id &&
                                  r.data.status !== "completed",
                              ).length
                            }
                          </p>
                        </article>
                      ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="toolbar">
                <input
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {statuses[module] && (
                  <select
                    aria-label={t("status")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">{t("status")}</option>
                    {statuses[module].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                )}
                {["ledger", "time", "invoices", "audit"].includes(module) && (
                  <>
                    <label>
                      {t("from")}
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      {t("to")}
                      <input
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                  </>
                )}
                {module === "ledger" && (
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label={t("service")}
                  >
                    <option value="">
                      {t("service")} / {t("customerId")}
                    </option>
                    {["software", "support", "hardware", "onsite"].map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                    {users
                      .filter((u) => u.role === "CUSTOMER")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                )}
                <button className="button outline small" onClick={exportReport}>
                  {t("download")} ↓
                </button>
                {["projects", "tasks"].includes(module) && (
                  <button
                    className="button outline small"
                    onClick={() => setBoard(!board)}
                  >
                    {t(board ? "list" : "board")}
                  </button>
                )}
              </div>
              {module === "ledger" && summaries(rows)}
              {module === "time" && (
                <div className="metric-grid">
                  <article className="metric">
                    <span>{t("recordedHours")}</span>
                    <strong>
                      {rows
                        .reduce((n, r) => n + Number(r.data.hours || 0), 0)
                        .toFixed(2)}
                    </strong>
                  </article>
                  {admin &&
                    users
                      .filter((u) => u.role !== "CUSTOMER")
                      .map((u) => (
                        <article className="metric" key={u.id}>
                          <span>{u.name}</span>
                          <strong>
                            {rows
                              .filter((r) => r.ownerId === u.id)
                              .reduce(
                                (n, r) => n + Number(r.data.hours || 0),
                                0,
                              )
                              .toFixed(2)}
                          </strong>
                          <small>{t("hours")}</small>
                        </article>
                      ))}
                </div>
              )}
              {module === "employees" ? (
                <div className="record-grid">
                  {users
                    .filter((u) =>
                      (u.name + " " + u.email)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((u) => (
                      <article className="work-card" key={u.id}>
                        <h3>{u.name}</h3>
                        <p>{u.email}</p>
                        <span className="badge">{t(u.role)}</span>
                        {u.role !== "CUSTOMER" && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const d = Object.fromEntries(
                                new FormData(e.currentTarget),
                              );
                              run(() =>
                                api(`/users/${u.id}`, "PATCH", {
                                  ...d,
                                  crmAccess: d.crmAccess === "on",
                                }),
                              );
                            }}
                          >
                            <label>
                              {t("role")}
                              <select name="role" defaultValue={u.role}>
                                <option value="EMPLOYEE">
                                  {t("EMPLOYEE")}
                                </option>
                                <option value="ADMIN">{t("ADMIN")}</option>
                              </select>
                            </label>
                            <label>
                              {t("department")}
                              <input
                                name="department"
                                defaultValue={u.department}
                              />
                            </label>
                            <label>
                              {t("position")}
                              <input
                                name="position"
                                defaultValue={u.position}
                              />
                            </label>
                            <label className="checkbox">
                              <input
                                name="crmAccess"
                                type="checkbox"
                                defaultChecked={u.crmAccess}
                              />
                              {t("crmAccess")}
                            </label>
                            <button className="button small" disabled={busy}>
                              {t("save")}
                            </button>
                          </form>
                        )}
                      </article>
                    ))}
                </div>
              ) : ["projects", "tasks"].includes(module) && board ? (
                <div className="kanban">
                  {["pending", "in_progress", "completed"].map((s) => (
                    <section className="kanban-column" key={s}>
                      <h3>
                        {t(s)}{" "}
                        <span>
                          {rows.filter((r) => r.data.status === s).length}
                        </span>
                      </h3>
                      {rows.filter((r) => r.data.status === s).map(rowCard)}
                    </section>
                  ))}
                </div>
              ) : rows.length ? (
                <div className="record-grid">{rows.map(rowCard)}</div>
              ) : (
                <Empty />
              )}
            </>
          )}
        </main>
      </div>
      {creating && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <div className="card-top">
              <h2 id="create-title">
                {t("create")} · {t(module)}
              </h2>
              <button
                className="close-button"
                aria-label={t("close")}
                onClick={() => setCreating(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={create}>
              <div className="form-grid">{currentFields.map(field)}</div>
              {notice && (
                <p role="alert" className="error">
                  {label(notice)}
                </p>
              )}
              <div className="actions">
                <button className="button" disabled={busy}>
                  {t(busy ? "saving" : "save")}
                </button>
                <button
                  type="button"
                  className="button outline"
                  onClick={() => setCreating(false)}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <Detail
          row={
            (data[selected.module] || []).find((r) => r.id === selected.id) ||
            selected
          }
          user={user}
          users={users}
          data={data}
          close={() => setSelected(null)}
          run={run}
          busy={busy}
          notice={notice}
        />
      )}
    </>
  );
}
function Empty() {
  const t = useTranslations();
  return (
    <div className="empty">
      <span aria-hidden>▤</span>
      <h3>{t("noRecords")}</h3>
      <p>{t("noRecordsText")}</p>
    </div>
  );
}
function Detail({
  row: r,
  user,
  users,
  data,
  close,
  run,
  busy,
  notice,
}: {
  row: Row;
  user: Account;
  users: Account[];
  data: Data;
  close: () => void;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  busy: boolean;
  notice: string;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [fileError, setFileError] = useState("");
  const [instructions, setInstructions] = useState("");
  const label = (s: string) => (t.has(s) ? t(s) : s);
  useEffect(() => {
    if (r.module === "tickets")
      api<{ id: string; name: string }[]>(`/tickets/${r.id}/attachments`)
        .then(setFiles)
        .catch((e) => setFileError(e.message));
  }, [r.id, r.module]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="card-top">
          <p className="eyebrow">
            {t(r.module)} / #{r.id.slice(0, 8)}
          </p>
          <button
            className="close-button"
            aria-label={t("close")}
            onClick={close}
          >
            ×
          </button>
        </div>
        <h2 id="detail-title">{label(String(r.data.title || "details"))}</h2>
        <dl className="detail-grid">
          {Object.entries(r.data)
            .filter(([k]) => !["title", "staff"].includes(k))
            .map(([k, v]) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>
                  {k.endsWith("Id")
                    ? users.find((u) => u.id === v)?.name ||
                      Object.values(data)
                        .flat()
                        .find((x) => x.id === v)?.data.title ||
                      String(v)
                    : k.endsWith("At")
                      ? new Date(String(v)).toLocaleString(locale)
                      : label(String(v))}
                </dd>
              </div>
            ))}
        </dl>
        {r.module === "projects" && (
          <p>
            {t("progress")}:{" "}
            {
              (data.tasks || []).filter(
                (x) =>
                  x.data.projectId === r.id && x.data.status === "completed",
              ).length
            }{" "}
            /{" "}
            {(data.tasks || []).filter((x) => x.data.projectId === r.id).length}{" "}
            {t("tasks")}
          </p>
        )}
        {r.module === "tickets" && (
          <>
            {user.role !== "CUSTOMER" && (
              <label>
                {t("assigneeId")}
                <select
                  value={r.assigneeId || ""}
                  disabled={busy}
                  onChange={(e) =>
                    run(() =>
                      api(`/records/tickets/${r.id}`, "PATCH", {
                        assigneeId: e.target.value,
                      }),
                    )
                  }
                >
                  <option value="">{t("unassigned")}</option>
                  {users
                    .filter((u) => u.role !== "CUSTOMER")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {user.role !== "CUSTOMER" && (
              <label>
                {t("priority")}
                <select
                  value={String(r.data.priority)}
                  disabled={busy}
                  onChange={(e) =>
                    run(() =>
                      api(`/records/tickets/${r.id}`, "PATCH", {
                        priority: e.target.value,
                      }),
                    )
                  }
                >
                  {["low", "normal", "high", "urgent"].map((priority) => (
                    <option key={priority} value={priority}>
                      {t(priority)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="ticket-metrics">
              {["firstResponseAt", "resolvedAt"]
                .filter((k) => r.data[k])
                .map((k) => (
                  <p key={k}>
                    {t(
                      k === "firstResponseAt"
                        ? "responseTime"
                        : "resolutionTime",
                    )}
                    :{" "}
                    {(
                      (Date.parse(String(r.data[k])) -
                        Date.parse(r.createdAt)) /
                      3600000
                    ).toFixed(2)}
                  </p>
                ))}
            </div>
            <h3>{t("replies")}</h3>
            <div className="conversation">
              {(data.replies || [])
                .filter((x) => x.data.ticketId === r.id)
                .reverse()
                .map((x) => (
                  <article key={x.id}>
                    <strong>
                      {String(x.data.author)}{" "}
                      <small>
                        · {new Date(x.createdAt).toLocaleString(locale)}
                      </small>
                    </strong>
                    <p>{String(x.data.message)}</p>
                  </article>
                ))}
            </div>
            {r.data.status !== "closed" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await run(() =>
                      api("/records/replies", "POST", {
                        ticketId: r.id,
                        message: new FormData(form).get("message"),
                      }),
                    )
                  )
                    form.reset();
                }}
              >
                <label>
                  {t("message")}
                  <textarea name="message" rows={3} maxLength={5000} required />
                </label>
                <button className="button small" disabled={busy}>
                  {t("reply")}
                </button>
              </form>
            )}
            <h3>{t("attachment")}</h3>
            {files.map((f) => (
              <p key={f.id}>
                <a
                  className="text-link"
                  href={`/api/tickets/${r.id}/attachments/${f.id}`}
                >
                  {f.name} ↓
                </a>
              </p>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                if (
                  await run(() =>
                    api(
                      `/tickets/${r.id}/attachments`,
                      "POST",
                      new FormData(f),
                    ),
                  )
                ) {
                  setFiles(await api(`/tickets/${r.id}/attachments`));
                  f.reset();
                }
              }}
            >
              <label>
                {t("attachment")} (PDF, PNG, JPEG, TXT · 5 MB)
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  required
                />
              </label>
              <button className="button outline small" disabled={busy}>
                {t("upload")}
              </button>
            </form>
            {fileError && <p className="error">{label(fileError)}</p>}
          </>
        )}
        {r.module === "invoices" && r.data.status !== "paid" && (
          <>
            <h3>{t("methods")}</h3>
            <div className="payment-methods">
              {["PSE", "Llave", "PayPal", "Wise Business"].map((method) => (
                <button
                  key={method}
                  className="button outline small"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api<{
                        url?: string;
                        instructions?: string;
                        reference?: string;
                      }>(`/invoices/${r.id}/checkout`, "POST", {
                        method,
                        locale,
                      });
                      if (result.url) window.location.assign(result.url);
                      else
                        setInstructions(
                          `${result.instructions} · ${result.reference}`,
                        );
                    })
                  }
                >
                  {method} ↗
                </button>
              ))}
            </div>
            {instructions && (
              <p>
                {t("paymentInstructions")}: {instructions}
              </p>
            )}
            {user.role === "ADMIN" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const reference = new FormData(e.currentTarget).get(
                    "reference",
                  );
                  run(() =>
                    api(`/invoices/${r.id}/settle`, "POST", { reference }),
                  );
                }}
              >
                <p className="fine-print">{t("paymentNote")}</p>
                <label>
                  {t("reference")}
                  <input
                    name="reference"
                    required
                    minLength={4}
                    maxLength={180}
                  />
                </label>
                <button className="button" disabled={busy}>
                  {t("settle")}
                </button>
              </form>
            )}
          </>
        )}
        {notice && (
          <p
            role="status"
            className={
              ["saved", "paymentSuccess"].includes(notice) ? "success" : "error"
            }
          >
            {label(notice)}
          </p>
        )}
      </section>
    </div>
  );
}
