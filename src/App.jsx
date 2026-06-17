import { useState, useMemo, useEffect, useCallback } from "react";

const STATUS_CONFIG = {
  rascunho:   { label: "Rascunho",   color: "#6B7280", bg: "#F3F4F6" },
  enviado:    { label: "Enviado",    color: "#D97706", bg: "#FEF3C7" },
  negociacao: { label: "Negociação", color: "#2563EB", bg: "#DBEAFE" },
  aprovado:   { label: "Aprovado",   color: "#16A34A", bg: "#DCFCE7" },
  perdido:    { label: "Perdido",    color: "#DC2626", bg: "#FEE2E2" },
  cancelado:  { label: "Cancelado",  color: "#9CA3AF", bg: "#F9FAFB" },
};

const TIPO_CONFIG = {
  reforma:     "Reforma",
  obra_nova:   "Obra Nova",
  recuperacao: "Recuperação Estrutural",
  laudo:       "Laudo / Inspeção",
  licitacao:   "Licitação Pública",
  outro:       "Outro",
};

const INITIAL_DATA = [
  { id: 1, numero: "0161/2026", cliente: "Marinha do Brasil", descricao: "Reforma Academia de Ginástica – BNVdC", tipo: "reforma", valor: 87500, status: "enviado", prazo: "2026-06-20", responsavel: "Rafael", criado: "2026-05-10" },
  { id: 2, numero: "0162/2026", cliente: "Paróquia Nª Sª das Neves", descricao: "Regularização de piso – Contrapiso", tipo: "reforma", valor: 24800, status: "aprovado", prazo: "2026-06-15", responsavel: "Rodrigo", criado: "2026-05-14" },
  { id: 3, numero: "0059/2025", cliente: "Catedral Metropolitana", descricao: "Recuperação Estrutural Rev.B", tipo: "recuperacao", valor: 198000, status: "negociacao", prazo: "2026-07-01", responsavel: "Rafael", criado: "2026-04-22" },
  { id: 4, numero: "0163/2026", cliente: "Marinha – BN Val-de-Cans", descricao: "Calçada em concreto armado 44m²", tipo: "obra_nova", valor: 32400, status: "aprovado", prazo: "2026-06-30", responsavel: "Rafael", criado: "2026-05-20" },
  { id: 5, numero: "0164/2026", cliente: "Marinha – BN Val-de-Cans", descricao: "Cobertura metálica arquibancada 8×2,5m", tipo: "obra_nova", valor: 61200, status: "enviado", prazo: "2026-07-10", responsavel: "Rafael", criado: "2026-05-22" },
  { id: 6, numero: "CE010/2026", cliente: "Pref. Belford Roxo", descricao: "Creche – Concorrência Eletrônica", tipo: "licitacao", valor: 3500000, status: "perdido", prazo: "2026-05-01", responsavel: "Rodrigo", criado: "2026-03-10" },
];

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron;

// Persistência: Electron (arquivo JSON) ou localStorage (browser)
const storage = {
  async save(data) {
    if (isElectron) {
      await window.electronAPI.saveData(data);
    } else {
      localStorage.setItem("attizani_orcamentos", JSON.stringify(data));
    }
  },
  async load() {
    if (isElectron) {
      const res = await window.electronAPI.loadData();
      return res.ok && res.data ? res.data : null;
    } else {
      const raw = localStorage.getItem("attizani_orcamentos");
      return raw ? JSON.parse(raw) : null;
    }
  },
};

const EMPTY_FORM = { numero: "", cliente: "", descricao: "", tipo: "reforma", valor: "", status: "rascunho", prazo: "", responsavel: "Rafael", criado: todayStr() };

function Badge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
  return (
    <span style={{ background: c.bg, color: c.color, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "18px 22px" }}>
      <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || "#111827", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0F172A", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
      {msg}
    </div>
  );
}

export default function App() {
  const [orcamentos, setOrcamentos] = useState(INITIAL_DATA);
  const [loaded, setLoaded] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tab, setTab] = useState("lista");
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState("desc");

  // Carregar dados salvos
  useEffect(() => {
    storage.load().then(data => {
      if (data) setOrcamentos(data);
      setLoaded(true);
    });
  }, []);

  // Salvar sempre que mudar
  useEffect(() => {
    if (loaded) storage.save(orcamentos);
  }, [orcamentos, loaded]);

  const showToast = (msg) => setToast(msg);

  const filtered = useMemo(() => {
    let list = [...orcamentos];
    if (filtro !== "todos") list = list.filter(o => o.status === filtro);
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(o =>
        o.cliente.toLowerCase().includes(q) ||
        o.descricao.toLowerCase().includes(q) ||
        o.numero.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === "valor") { va = Number(va); vb = Number(vb); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [orcamentos, filtro, busca, sortBy, sortDir]);

  const stats = useMemo(() => {
    const total = orcamentos.reduce((s, o) => s + Number(o.valor), 0);
    const aprovado = orcamentos.filter(o => o.status === "aprovado").reduce((s, o) => s + Number(o.valor), 0);
    const pipeline = orcamentos.filter(o => ["enviado", "negociacao"].includes(o.status)).reduce((s, o) => s + Number(o.valor), 0);
    const encerrados = orcamentos.filter(o => ["aprovado", "perdido", "cancelado"].includes(o.status)).length;
    const taxa = encerrados ? Math.round((orcamentos.filter(o => o.status === "aprovado").length / encerrados) * 100) : 0;
    const vencendo = orcamentos.filter(o => {
      if (!o.prazo || ["aprovado","perdido","cancelado"].includes(o.status)) return false;
      const diff = (new Date(o.prazo) - new Date()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length;
    return { total, aprovado, pipeline, taxa, vencendo };
  }, [orcamentos]);

  function nextNumero() {
    const nums = orcamentos.map(o => parseInt(o.numero)).filter(Boolean);
    const max = nums.length ? Math.max(...nums) : 164;
    return `0${max + 1}/2026`;
  }

  function openNew() { setForm({ ...EMPTY_FORM, numero: nextNumero(), criado: todayStr() }); setModal("novo"); }
  function openEdit(o) { setForm({ ...o, valor: String(o.valor) }); setModal(o.id); }
  function closeModal() { setModal(null); }

  function save() {
    if (!form.numero || !form.cliente || !form.descricao || !form.valor) {
      showToast("⚠️ Preencha todos os campos obrigatórios");
      return;
    }
    if (modal === "novo") {
      setOrcamentos(prev => [...prev, { ...form, id: Date.now(), valor: Number(form.valor) }]);
      showToast("✅ Orçamento criado");
    } else {
      setOrcamentos(prev => prev.map(o => o.id === modal ? { ...form, id: o.id, valor: Number(form.valor) } : o));
      showToast("✅ Alterações salvas");
    }
    closeModal();
  }

  function remove(id) {
    if (window.confirm("Excluir este orçamento permanentemente?")) {
      setOrcamentos(prev => prev.filter(o => o.id !== id));
      showToast("🗑 Orçamento removido");
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  const SortIcon = ({ col }) => sortBy !== col ? null : (
    <span style={{ marginLeft: 4, fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
  );

  const kanbanCols = ["rascunho", "enviado", "negociacao", "aprovado", "perdido"];

  const inputStyle = { width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "Inter, sans-serif" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh", color: "#111827" }}>

      {/* HEADER */}
      <div style={{ background: "#0F172A", padding: "0 28px", display: "flex", alignItems: "center", gap: 16, height: 56, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "#F59E0B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0F172A", fontWeight: 900, fontSize: 15 }}>A</span>
          </div>
          <div>
            <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 14, letterSpacing: -0.3, lineHeight: 1 }}>Attizani Engenharia</div>
            <div style={{ color: "#64748B", fontSize: 11, marginTop: 1 }}>Gestão de Orçamentos</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {stats.vencendo > 0 && (
          <div style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600 }}>
            ⚠️ {stats.vencendo} orç. vencem em 7 dias
          </div>
        )}
        <span style={{ color: "#334155", fontSize: 12 }}>{isElectron ? "💾 Salvo localmente" : "🌐 Salvo no browser"}</span>
        <button onClick={openNew} style={{ background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Novo Orçamento
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>

        {/* KPI CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          <StatCard label="Pipeline Ativo" value={fmt(stats.pipeline)} sub={`${orcamentos.filter(o => ["enviado","negociacao"].includes(o.status)).length} orçamentos em aberto`} accent="#2563EB" />
          <StatCard label="Total Aprovado" value={fmt(stats.aprovado)} sub={`${orcamentos.filter(o => o.status === "aprovado").length} contratos fechados`} accent="#16A34A" />
          <StatCard label="Volume Total" value={fmt(stats.total)} sub={`${orcamentos.length} orçamentos cadastrados`} />
          <StatCard label="Taxa de Conversão" value={`${stats.taxa}%`} sub="aprovados sobre encerrados" accent={stats.taxa >= 50 ? "#16A34A" : "#D97706"} />
        </div>

        {/* TABS */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["lista","📋 Lista"], ["kanban","🗂 Kanban"], ["stats","📊 Análise"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab===t ? "#0F172A" : "#fff", color: tab===t ? "#fff" : "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {l}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, descrição, número…"
            style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 14px", fontSize: 13, width: 260, outline: "none" }} />
        </div>

        {/* FILTRO STATUS (lista) */}
        {tab === "lista" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["todos", ...Object.keys(STATUS_CONFIG)].map(s => {
              const count = s === "todos" ? orcamentos.length : orcamentos.filter(o => o.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <button key={s} onClick={() => setFiltro(s)} style={{
                  background: filtro===s ? (cfg?.bg || "#0F172A") : "#fff",
                  color: filtro===s ? (cfg?.color || "#fff") : "#6B7280",
                  border: `1px solid ${filtro===s ? (cfg?.color || "#0F172A") : "#E5E7EB"}`,
                  borderRadius: 99, padding: "4px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>
                  {s === "todos" ? `Todos (${count})` : `${cfg.label} (${count})`}
                </button>
              );
            })}
          </div>
        )}

        {/* LISTA */}
        {tab === "lista" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  {[["numero","Nº"],["cliente","Cliente"],["descricao","Descrição"],["tipo","Tipo"],["valor","Valor"],["status","Status"],["prazo","Prazo"],["responsavel","Resp."]].map(([col, h]) => (
                    <th key={col} onClick={() => toggleSort(col)}
                      style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {h}<SortIcon col={col} />
                    </th>
                  ))}
                  <th style={{ padding: "10px 14px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Nenhum orçamento encontrado.</td></tr>
                )}
                {filtered.map((o, i) => {
                  const vencido = o.prazo && o.prazo < todayStr() && !["aprovado","perdido","cancelado"].includes(o.status);
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid #F3F4F6", background: vencido ? "#FFF5F5" : i%2===0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{o.numero}</td>
                      <td style={{ padding: "10px 14px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.cliente}</td>
                      <td style={{ padding: "10px 14px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{o.descricao}</td>
                      <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12, whiteSpace: "nowrap" }}>{TIPO_CONFIG[o.tipo]}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, whiteSpace: "nowrap", color: "#0F172A" }}>{fmt(o.valor)}</td>
                      <td style={{ padding: "10px 14px" }}><Badge status={o.status} /></td>
                      <td style={{ padding: "10px 14px", color: vencido ? "#DC2626" : "#6B7280", fontSize: 12, whiteSpace: "nowrap", fontWeight: vencido ? 700 : 400 }}>
                        {o.prazo ? new Date(o.prazo + "T12:00:00").toLocaleDateString("pt-BR") : "–"}
                        {vencido && " ⚠️"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12 }}>{o.responsavel}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(o)} style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, marginRight: 4 }}>Editar</button>
                        <button onClick={() => remove(o.id)} style={{ background: "none", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* KANBAN */}
        {tab === "kanban" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
            {kanbanCols.map(col => {
              const cards = orcamentos.filter(o => o.status === col);
              const total = cards.reduce((s, o) => s + Number(o.valor), 0);
              const cfg = STATUS_CONFIG[col];
              return (
                <div key={col} style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: cfg.bg, padding: "10px 14px", borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ fontWeight: 700, color: cfg.color, fontSize: 12 }}>{cfg.label.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{cards.length} orç. · {fmt(total)}</div>
                  </div>
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                    {cards.length === 0 && <div style={{ color: "#D1D5DB", fontSize: 12, textAlign: "center", padding: "16px 0" }}>Vazio</div>}
                    {cards.map(o => (
                      <div key={o.id} onClick={() => openEdit(o)}
                        style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>{o.numero}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 3, lineHeight: 1.3 }}>{o.cliente}</div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, lineHeight: 1.3 }}>{o.descricao}</div>
                        <div style={{ fontWeight: 700, color: "#16A34A", fontSize: 13 }}>{fmt(o.valor)}</div>
                        {o.prazo && <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>Prazo: {new Date(o.prazo + "T12:00:00").toLocaleDateString("pt-BR")}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ANÁLISE */}
        {tab === "stats" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: "#0F172A" }}>Volume por Status</div>
              {Object.keys(STATUS_CONFIG).map(s => {
                const val = orcamentos.filter(o => o.status === s).reduce((sum, o) => sum + Number(o.valor), 0);
                const pct = stats.total ? Math.round((val / stats.total) * 100) : 0;
                const cfg = STATUS_CONFIG[s];
                return (
                  <div key={s} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                      <span style={{ color: "#374151", fontWeight: 600 }}>{fmt(val)} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ background: "#F3F4F6", borderRadius: 99, height: 7 }}>
                      <div style={{ background: cfg.color, width: `${pct}%`, height: 7, borderRadius: 99, transition: "width .5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: "#0F172A" }}>Por Tipo de Serviço</div>
                {Object.entries(TIPO_CONFIG).map(([key, label]) => {
                  const val = orcamentos.filter(o => o.tipo === key).reduce((s, o) => s + Number(o.valor), 0);
                  if (!val) return null;
                  const pct = stats.total ? Math.round((val / stats.total) * 100) : 0;
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#374151" }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(val)} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ background: "#F3F4F6", borderRadius: 99, height: 6 }}>
                        <div style={{ background: "#F59E0B", width: `${pct}%`, height: 6, borderRadius: 99, transition: "width .5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, color: "#0F172A" }}>Por Responsável</div>
                {["Rafael", "Rodrigo"].map(r => {
                  const val = orcamentos.filter(o => o.responsavel === r).reduce((s, o) => s + Number(o.valor), 0);
                  const pct = stats.total ? Math.round((val / stats.total) * 100) : 0;
                  return (
                    <div key={r} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{r}</span><span style={{ fontWeight: 600 }}>{fmt(val)} ({pct}%)</span>
                      </div>
                      <div style={{ background: "#F3F4F6", borderRadius: 99, height: 6 }}>
                        <div style={{ background: "#2563EB", width: `${pct}%`, height: 6, borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modal !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 22, color: "#0F172A" }}>
              {modal === "novo" ? "➕ Novo Orçamento" : "✏️ Editar Orçamento"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[["numero","Número *","text"],["cliente","Cliente *","text"],["valor","Valor (R$) *","number"],["prazo","Prazo de Validade","date"],["responsavel","Responsável","text"],["criado","Data de Criação","date"]].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: ["cliente","descricao"].includes(key) ? "1 / -1" : undefined }}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Descrição *</label>
                <input type="text" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={{ ...inputStyle, background: "#fff" }}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle, background: "#fff" }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <button onClick={closeModal} style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Cancelar</button>
              <button onClick={save} style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                {modal === "novo" ? "Criar Orçamento" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
