import { useState, useMemo, useEffect, useCallback } from "react";

// ============================================================
// FIREBASE CONFIG — não altere
// ============================================================
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCutKdZy_4JbCtw54ieaQWrdQjJMexIbEE",
  authDomain: "attizani--gestao-orcamentos.firebaseapp.com",
  projectId: "attizani--gestao-orcamentos",
  storageBucket: "attizani--gestao-orcamentos.firebasestorage.app",
  messagingSenderId: "764624725441",
  appId: "1:764624725441:web:91889cdfc860ea155ffb40"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLECAO = "orcamentos";

// ============================================================
// CONFIGURAÇÕES
// ============================================================
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

const PAGAMENTO_CONFIG = ["À vista", "Parcelado", "Medição mensal", "Outro"];
const FONTE_CONFIG = ["Indicação", "Licitação", "Site", "Retorno de cliente", "Prospecção", "Outro"];

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  numero: "", revisao: "A", cliente: "", cnpj: "", contato_tel: "", contato_email: "",
  descricao: "", tipo: "reforma", endereco: "",
  valor: "", mao_de_obra: "", material: "",
  bdi: "", margem: "", prazo_execucao: "",
  forma_pagamento: "À vista", fonte: "Indicação",
  art: "", contrato: "", status: "rascunho",
  prazo: "", responsavel: "Rafael", criado: todayStr(),
  observacoes: "", historico: [],
};

// ============================================================
// COMPONENTES
// ============================================================
function Badge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
  return <span style={{ background: c.bg, color: c.color, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{c.label}</span>;
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent || "#111827", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  return <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0F172A", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>{msg}</div>;
}

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #E5E7EB", borderTop: "3px solid #F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: "#6B7280", fontSize: 14 }}>Carregando dados do Firebase...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inp = { border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 11px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "#fff" };
const lbl = { fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 };

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lista");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroResp, setFiltroResp] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroValorMin, setFiltroValorMin] = useState("");
  const [filtroValorMax, setFiltroValorMax] = useState("");
  const [sortBy, setSortBy] = useState("criado");
  const [sortDir, setSortDir] = useState("desc");
  const [modal, setModal] = useState(null);
  const [modalTab, setModalTab] = useState("geral");
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (m) => setToast(m);

  // Carregar dados do Firebase em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLECAO), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrcamentos(data);
      setLoading(false);
    }, (err) => {
      console.error("Erro Firebase:", err);
      showToast("❌ Erro ao conectar com o banco de dados");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtros e ordenação
  const filtered = useMemo(() => {
    let list = [...orcamentos];
    if (filtro !== "todos") list = list.filter(o => o.status === filtro);
    if (filtroTipo !== "todos") list = list.filter(o => o.tipo === filtroTipo);
    if (filtroResp !== "todos") list = list.filter(o => o.responsavel === filtroResp);
    if (filtroValorMin) list = list.filter(o => Number(o.valor) >= Number(filtroValorMin));
    if (filtroValorMax) list = list.filter(o => Number(o.valor) <= Number(filtroValorMax));
    if (filtroPeriodo !== "todos") {
      const now = new Date(); const mes = now.getMonth(); const ano = now.getFullYear();
      list = list.filter(o => {
        if (!o.criado) return true;
        const d = new Date(o.criado);
        if (filtroPeriodo === "mes") return d.getMonth() === mes && d.getFullYear() === ano;
        if (filtroPeriodo === "trim") return Math.floor(d.getMonth() / 3) === Math.floor(mes / 3) && d.getFullYear() === ano;
        if (filtroPeriodo === "ano") return d.getFullYear() === ano;
        return true;
      });
    }
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(o =>
        (o.cliente || "").toLowerCase().includes(q) ||
        (o.descricao || "").toLowerCase().includes(q) ||
        (o.numero || "").toLowerCase().includes(q) ||
        (o.cnpj || "").includes(q)
      );
    }
    list.sort((a, b) => {
      let va = a[sortBy] || "", vb = b[sortBy] || "";
      if (["valor","mao_de_obra","material","bdi","margem"].includes(sortBy)) { va = Number(va); vb = Number(vb); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [orcamentos, filtro, filtroTipo, filtroResp, filtroValorMin, filtroValorMax, filtroPeriodo, busca, sortBy, sortDir]);

  // KPIs
  const stats = useMemo(() => {
    const total = orcamentos.reduce((s, o) => s + Number(o.valor || 0), 0);
    const aprovado = orcamentos.filter(o => o.status === "aprovado").reduce((s, o) => s + Number(o.valor || 0), 0);
    const pipeline = orcamentos.filter(o => ["enviado","negociacao"].includes(o.status)).reduce((s, o) => s + Number(o.valor || 0), 0);
    const encerrados = orcamentos.filter(o => ["aprovado","perdido","cancelado"].includes(o.status)).length;
    const taxa = encerrados ? Math.round((orcamentos.filter(o => o.status === "aprovado").length / encerrados) * 100) : 0;
    const totalMO = orcamentos.filter(o => o.status === "aprovado").reduce((s, o) => s + Number(o.mao_de_obra || 0), 0);
    const totalMat = orcamentos.filter(o => o.status === "aprovado").reduce((s, o) => s + Number(o.material || 0), 0);
    const vencendo = orcamentos.filter(o => {
      if (!o.prazo || ["aprovado","perdido","cancelado"].includes(o.status)) return false;
      const diff = (new Date(o.prazo) - new Date()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length;
    return { total, aprovado, pipeline, taxa, vencendo, totalMO, totalMat };
  }, [orcamentos]);

  // Relatórios
  const relConversaoPorTipo = useMemo(() => {
    return Object.entries(TIPO_CONFIG).map(([key, label]) => {
      const total = orcamentos.filter(o => o.tipo === key && ["aprovado","perdido","cancelado"].includes(o.status)).length;
      const aprov = orcamentos.filter(o => o.tipo === key && o.status === "aprovado").length;
      return { key, label, total, aprov, taxa: total ? Math.round((aprov / total) * 100) : 0 };
    }).filter(r => r.total > 0).sort((a, b) => b.taxa - a.taxa);
  }, [orcamentos]);

  const relClienteVolume = useMemo(() => {
    const map = {};
    orcamentos.forEach(o => {
      if (!map[o.cliente]) map[o.cliente] = { cliente: o.cliente, total: 0, count: 0, aprovado: 0 };
      map[o.cliente].total += Number(o.valor || 0);
      map[o.cliente].count++;
      if (o.status === "aprovado") map[o.cliente].aprovado += Number(o.valor || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [orcamentos]);

  const relMensal = useMemo(() => {
    const map = {};
    orcamentos.forEach(o => {
      const mes = o.criado ? o.criado.slice(0, 7) : "?";
      if (!map[mes]) map[mes] = { mes, aprovado: 0, perdido: 0, pipeline: 0 };
      if (o.status === "aprovado") map[mes].aprovado += Number(o.valor || 0);
      else if (o.status === "perdido") map[mes].perdido += Number(o.valor || 0);
      else map[mes].pipeline += Number(o.valor || 0);
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  }, [orcamentos]);

  function nextNumero() {
    const nums = orcamentos.map(o => parseInt(o.numero)).filter(Boolean);
    const max = nums.length ? Math.max(...nums) : 164;
    return `0${max + 1}/2026`;
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, numero: nextNumero(), criado: todayStr(), historico: [{ status: "rascunho", data: todayStr(), obs: "Criado" }] });
    setModal("novo"); setModalTab("geral");
  }

  function openEdit(o) {
    setForm({ ...o, valor: String(o.valor || ""), mao_de_obra: String(o.mao_de_obra || ""), material: String(o.material || "") });
    setModal(o.id); setModalTab("geral");
  }

  function changeStatus(newStatus) {
    const entry = { status: newStatus, data: todayStr(), obs: "" };
    setForm(p => ({ ...p, status: newStatus, historico: [...(p.historico || []), entry] }));
  }

  async function salvar() {
    if (!form.numero || !form.cliente || !form.descricao || !form.valor) {
      showToast("⚠️ Preencha número, cliente, descrição e valor"); return;
    }
    setSaving(true);
    const record = {
      ...form,
      valor: Number(form.valor || 0),
      mao_de_obra: Number(form.mao_de_obra || 0),
      material: Number(form.material || 0),
      bdi: Number(form.bdi || 0),
      margem: Number(form.margem || 0),
      prazo_execucao: Number(form.prazo_execucao || 0),
    };
    try {
      if (modal === "novo") {
        await addDoc(collection(db, COLECAO), record);
        showToast("✅ Orçamento criado no Firebase");
      } else {
        const { id, ...data } = record;
        await updateDoc(doc(db, COLECAO, modal), data);
        showToast("✅ Alterações salvas no Firebase");
      }
      setModal(null);
    } catch (e) {
      showToast("❌ Erro ao salvar: " + e.message);
    }
    setSaving(false);
  }

  async function duplicar(o) {
    const { id, ...data } = o;
    const novo = { ...data, numero: nextNumero(), revisao: "A", status: "rascunho", contrato: "", art: "", criado: todayStr(), historico: [{ status: "rascunho", data: todayStr(), obs: `Duplicado de ${o.numero}` }] };
    try {
      await addDoc(collection(db, COLECAO), novo);
      showToast(`✅ Duplicado como ${novo.numero}`);
    } catch (e) { showToast("❌ Erro ao duplicar"); }
  }

  async function remover(id) {
    if (!window.confirm("Excluir este orçamento permanentemente?")) return;
    try {
      await deleteDoc(doc(db, COLECAO, id));
      showToast("🗑 Orçamento removido");
      if (detalhe?.id === id) setDetalhe(null);
    } catch (e) { showToast("❌ Erro ao excluir"); }
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  const SortIcon = ({ col }) => sortBy !== col ? null : <span style={{ marginLeft: 3, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  const kanbanCols = ["rascunho","enviado","negociacao","aprovado","perdido"];

  if (loading) return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      <div style={{ background: "#0F172A", height: 54, display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
        <div style={{ width: 30, height: 30, background: "#F59E0B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#0F172A" }}>A</div>
        <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 13 }}>Attizani Engenharia</div>
      </div>
      <Loading />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh", color: "#111827" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <div style={{ background: "#0F172A", padding: "0 24px", display: "flex", alignItems: "center", gap: 14, height: 54, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 30, height: 30, background: "#F59E0B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#0F172A", flexShrink: 0 }}>A</div>
        <div>
          <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 13, lineHeight: 1 }}>Attizani Engenharia</div>
          <div style={{ color: "#64748B", fontSize: 10, marginTop: 1 }}>Gestão de Orçamentos · 🟢 Firebase Online</div>
        </div>
        <div style={{ flex: 1 }} />
        {stats.vencendo > 0 && <div style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>⚠️ {stats.vencendo} vencem em 7 dias</div>}
        <button onClick={openNew} style={{ background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Novo Orçamento</button>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Pipeline" value={fmt(stats.pipeline)} sub={`${orcamentos.filter(o => ["enviado","negociacao"].includes(o.status)).length} em aberto`} accent="#2563EB" />
          <StatCard label="Aprovado" value={fmt(stats.aprovado)} sub={`${orcamentos.filter(o => o.status === "aprovado").length} contratos`} accent="#16A34A" />
          <StatCard label="MO Aprovada" value={fmt(stats.totalMO)} sub="mão de obra" accent="#7C3AED" />
          <StatCard label="Material Aprov." value={fmt(stats.totalMat)} sub="materiais" accent="#0891B2" />
          <StatCard label="Volume Total" value={fmt(stats.total)} sub={`${orcamentos.length} orçamentos`} />
          <StatCard label="Conversão" value={`${stats.taxa}%`} sub="aprovados/encerrados" accent={stats.taxa >= 50 ? "#16A34A" : "#D97706"} />
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {[["lista","📋 Lista"],["kanban","🗂 Kanban"],["relatorios","📊 Relatórios"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab===t ? "#0F172A" : "#fff", color: tab===t ? "#fff" : "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", fontSize: 13, width: 200, outline: "none" }} />
        </div>

        {/* FILTROS */}
        {tab === "lista" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {["todos", ...Object.keys(STATUS_CONFIG)].map(s => {
              const cnt = s === "todos" ? orcamentos.length : orcamentos.filter(o => o.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <button key={s} onClick={() => setFiltro(s)} style={{ background: filtro===s ? (cfg?.bg || "#0F172A") : "#fff", color: filtro===s ? (cfg?.color || "#fff") : "#6B7280", border: `1px solid ${filtro===s ? (cfg?.color || "#0F172A") : "#E5E7EB"}`, borderRadius: 99, padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {s === "todos" ? `Todos (${cnt})` : `${cfg.label} (${cnt})`}
                </button>
              );
            })}
            <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 10px", fontSize: 12, background: "#fff" }}>
              <option value="todos">Todos os tipos</option>
              {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 10px", fontSize: 12, background: "#fff" }}>
              <option value="todos">Todos</option>
              <option value="Rafael">Rafael</option>
              <option value="Rodrigo">Rodrigo</option>
            </select>
            <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 10px", fontSize: 12, background: "#fff" }}>
              <option value="todos">Todo período</option>
              <option value="mes">Este mês</option>
              <option value="trim">Este trimestre</option>
              <option value="ano">Este ano</option>
            </select>
            <input value={filtroValorMin} onChange={e => setFiltroValorMin(e.target.value)} placeholder="Valor mín." type="number" style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", fontSize: 12, width: 90 }} />
            <input value={filtroValorMax} onChange={e => setFiltroValorMax(e.target.value)} placeholder="Valor máx." type="number" style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", fontSize: 12, width: 90 }} />
          </div>
        )}

        {/* LISTA */}
        {tab === "lista" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  {[["numero","Nº / Rev"],["cliente","Cliente"],["descricao","Descrição"],["tipo","Tipo"],["valor","Total"],["mao_de_obra","Mão de Obra"],["material","Material"],["bdi","BDI"],["margem","Margem"],["status","Status"],["prazo","Prazo"],["responsavel","Resp."]].map(([col, h]) => (
                    <th key={col} onClick={() => toggleSort(col)} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {h}<SortIcon col={col} />
                    </th>
                  ))}
                  <th style={{ padding: "9px 12px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={13} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Nenhum orçamento encontrado.</td></tr>}
                {filtered.map((o, i) => {
                  const vencido = o.prazo && o.prazo < todayStr() && !["aprovado","perdido","cancelado"].includes(o.status);
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid #F3F4F6", background: vencido ? "#FFF5F5" : i%2===0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{o.numero}<span style={{ color: "#9CA3AF", fontWeight: 400 }}> R{o.revisao}</span></td>
                      <td style={{ padding: "9px 12px", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.cliente}>{o.cliente}</td>
                      <td style={{ padding: "9px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.descricao}>{o.descricao}</td>
                      <td style={{ padding: "9px 12px", color: "#6B7280", whiteSpace: "nowrap" }}>{TIPO_CONFIG[o.tipo]}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(o.valor)}</td>
                      <td style={{ padding: "9px 12px", color: "#7C3AED", whiteSpace: "nowrap" }}>{fmt(o.mao_de_obra)}</td>
                      <td style={{ padding: "9px 12px", color: "#0891B2", whiteSpace: "nowrap" }}>{fmt(o.material)}</td>
                      <td style={{ padding: "9px 12px", color: "#6B7280", whiteSpace: "nowrap" }}>{fmtPct(o.bdi)}</td>
                      <td style={{ padding: "9px 12px", color: Number(o.margem) >= 15 ? "#16A34A" : "#D97706", whiteSpace: "nowrap", fontWeight: 600 }}>{fmtPct(o.margem)}</td>
                      <td style={{ padding: "9px 12px" }}><Badge status={o.status} /></td>
                      <td style={{ padding: "9px 12px", color: vencido ? "#DC2626" : "#6B7280", whiteSpace: "nowrap", fontWeight: vencido ? 700 : 400 }}>{o.prazo ? new Date(o.prazo + "T12:00:00").toLocaleDateString("pt-BR") : "–"}{vencido ? " ⚠️" : ""}</td>
                      <td style={{ padding: "9px 12px", color: "#6B7280" }}>{o.responsavel}</td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", display: "flex", gap: 4 }}>
                        <button onClick={() => setDetalhe(o)} style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Ver</button>
                        <button onClick={() => openEdit(o)} style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Editar</button>
                        <button onClick={() => duplicar(o)} title="Duplicar" style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>⧉</button>
                        <button onClick={() => remover(o.id)} style={{ background: "none", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {kanbanCols.map(col => {
              const cards = orcamentos.filter(o => o.status === col);
              const totalV = cards.reduce((s, o) => s + Number(o.valor || 0), 0);
              const cfg = STATUS_CONFIG[col];
              return (
                <div key={col} style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: cfg.bg, padding: "10px 12px", borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ fontWeight: 700, color: cfg.color, fontSize: 11 }}>{cfg.label.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{cards.length} · {fmt(totalV)}</div>
                  </div>
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, minHeight: 60 }}>
                    {cards.length === 0 && <div style={{ color: "#D1D5DB", fontSize: 11, textAlign: "center", padding: "12px 0" }}>Vazio</div>}
                    {cards.map(o => (
                      <div key={o.id} onClick={() => setDetalhe(o)} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{o.numero} R{o.revisao}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#0F172A", margin: "3px 0", lineHeight: 1.3 }}>{o.cliente}</div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, lineHeight: 1.3 }}>{o.descricao}</div>
                        <div style={{ fontWeight: 700, color: "#16A34A", fontSize: 13 }}>{fmt(o.valor)}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: "#7C3AED" }}>MO: {fmt(o.mao_de_obra)}</span>
                          <span style={{ fontSize: 10, color: "#0891B2" }}>Mat: {fmt(o.material)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RELATÓRIOS */}
        {tab === "relatorios" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#0F172A" }}>Evolução Mensal</div>
              {relMensal.map(d => (
                <div key={d.mes} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#6B7280" }}>{d.mes}</span>
                    <span><span style={{ color: "#16A34A", fontWeight: 600 }}>{fmt(d.aprovado)}</span> <span style={{ color: "#DC2626", fontSize: 11 }}>/ perdido: {fmt(d.perdido)}</span></span>
                  </div>
                  <div style={{ background: "#F3F4F6", borderRadius: 99, height: 6, display: "flex", overflow: "hidden" }}>
                    <div style={{ background: "#16A34A", width: `${d.aprovado + d.perdido + d.pipeline ? (d.aprovado / (d.aprovado + d.perdido + d.pipeline)) * 100 : 0}%`, height: 6 }} />
                    <div style={{ background: "#DC2626", width: `${d.aprovado + d.perdido + d.pipeline ? (d.perdido / (d.aprovado + d.perdido + d.pipeline)) * 100 : 0}%`, height: 6 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#0F172A" }}>Taxa de Conversão por Tipo</div>
              {relConversaoPorTipo.map(r => (
                <div key={r.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{r.label}</span>
                    <span style={{ fontWeight: 700, color: r.taxa >= 50 ? "#16A34A" : "#D97706" }}>{r.taxa}% <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({r.aprov}/{r.total})</span></span>
                  </div>
                  <div style={{ background: "#F3F4F6", borderRadius: 99, height: 6 }}>
                    <div style={{ background: r.taxa >= 50 ? "#16A34A" : "#D97706", width: `${r.taxa}%`, height: 6, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#0F172A" }}>Ranking de Clientes</div>
              {relClienteVolume.map((c, i) => (
                <div key={c.cliente} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 99, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "#6B7280", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.cliente}>{c.cliente}</div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>{fmt(c.total)}</div>
                    <div style={{ fontSize: 11, color: "#16A34A" }}>{fmt(c.aprovado)} aprov.</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#0F172A" }}>Composição dos Aprovados</div>
              {(() => {
                const aprov = orcamentos.filter(o => o.status === "aprovado");
                const totalV = aprov.reduce((s, o) => s + Number(o.valor || 0), 0);
                const totalMO = aprov.reduce((s, o) => s + Number(o.mao_de_obra || 0), 0);
                const totalMat = aprov.reduce((s, o) => s + Number(o.material || 0), 0);
                return (
                  <>
                    {[["Mão de Obra", totalMO, totalV, "#7C3AED"], ["Material", totalMat, totalV, "#0891B2"]].map(([label, val, tot, color]) => {
                      const pct = tot ? Math.round((val / tot) * 100) : 0;
                      return (
                        <div key={label} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color, fontWeight: 600 }}>{label}</span>
                            <span style={{ fontWeight: 700 }}>{fmt(val)} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span></span>
                          </div>
                          <div style={{ background: "#F3F4F6", borderRadius: 99, height: 8 }}>
                            <div style={{ background: color, width: `${pct}%`, height: 8, borderRadius: 99 }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #F3F4F6", fontSize: 12, color: "#6B7280" }}>
                      Margem média: <strong style={{ color: "#0F172A" }}>{aprov.length ? fmtPct(aprov.reduce((s, o) => s + Number(o.margem || 0), 0) / aprov.length) : "–"}</strong>
                      &nbsp;·&nbsp; BDI médio: <strong style={{ color: "#0F172A" }}>{aprov.length ? fmtPct(aprov.reduce((s, o) => s + Number(o.bdi || 0), 0) / aprov.length) : "–"}</strong>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHE */}
      {detalhe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{detalhe.numero} Rev.{detalhe.revisao}</div>
                <div style={{ color: "#6B7280", fontSize: 13 }}>{detalhe.cliente}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setDetalhe(null); openEdit(detalhe); }} style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Editar</button>
                <button onClick={() => setDetalhe(null)} style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                ["Descrição", detalhe.descricao, "1/-1"],
                ["Endereço", detalhe.endereco, "1/-1"],
                ["Status", <Badge status={detalhe.status} />],
                ["Tipo", TIPO_CONFIG[detalhe.tipo]],
                ["Valor Total", fmt(detalhe.valor)],
                ["Mão de Obra", <span style={{ color: "#7C3AED", fontWeight: 700 }}>{fmt(detalhe.mao_de_obra)}</span>],
                ["Material", <span style={{ color: "#0891B2", fontWeight: 700 }}>{fmt(detalhe.material)}</span>],
                ["BDI", fmtPct(detalhe.bdi)],
                ["Margem", fmtPct(detalhe.margem)],
                ["Prazo Exec.", `${detalhe.prazo_execucao || "–"} dias`],
                ["Pagamento", detalhe.forma_pagamento],
                ["Fonte", detalhe.fonte],
                ["ART", detalhe.art || "–"],
                ["Contrato", detalhe.contrato || "–"],
                ["CNPJ", detalhe.cnpj || "–"],
                ["Telefone", detalhe.contato_tel || "–"],
                ["E-mail", detalhe.contato_email || "–"],
                ["Responsável", detalhe.responsavel],
              ].map(([label, val, col]) => (
                <div key={label} style={{ gridColumn: col }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#0F172A" }}>{val}</div>
                </div>
              ))}
            </div>
            {detalhe.observacoes && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#D97706", fontWeight: 700, marginBottom: 4 }}>OBSERVAÇÕES</div>
                <div style={{ fontSize: 13 }}>{detalhe.observacoes}</div>
              </div>
            )}
            {detalhe.historico?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>HISTÓRICO DE STATUS</div>
                {detalhe.historico.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <Badge status={h.status} />
                    <span style={{ fontSize: 12, color: "#6B7280" }}>{h.data ? new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR") : ""}</span>
                    {h.obs && <span style={{ fontSize: 12, color: "#374151" }}>{h.obs}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {modal !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{modal === "novo" ? "➕ Novo Orçamento" : `✏️ Editar — ${form.numero}`}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["geral","cliente","financeiro","extras"].map(t => (
                  <button key={t} onClick={() => setModalTab(t)} style={{ background: modalTab===t ? "#0F172A" : "#F3F4F6", color: modalTab===t ? "#fff" : "#6B7280", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: "16px 24px" }}>
              {modalTab === "geral" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["numero","Número *","text"],["revisao","Revisão","text"],["responsavel","Responsável","text"],["criado","Data Criação","date"],["prazo","Prazo Validade","date"],["prazo_execucao","Prazo Execução (dias)","number"]].map(([k,l,t]) => (
                    <div key={k}><label style={lbl}>{l}</label><input type={t} value={form[k] || ""} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} /></div>
                  ))}
                  <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Descrição *</label><input type="text" value={form.descricao || ""} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} style={inp} /></div>
                  <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Endereço / Localização da Obra</label><input type="text" value={form.endereco || ""} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Tipo</label><select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={inp}>{Object.entries(TIPO_CONFIG).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><label style={lbl}>Status</label><select value={form.status} onChange={e => changeStatus(e.target.value)} style={inp}>{Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div><label style={lbl}>Forma de Pagamento</label><select value={form.forma_pagamento || ""} onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))} style={inp}>{PAGAMENTO_CONFIG.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  <div><label style={lbl}>Fonte do Cliente</label><select value={form.fonte || ""} onChange={e => setForm(p => ({ ...p, fonte: e.target.value }))} style={inp}>{FONTE_CONFIG.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                </div>
              )}
              {modalTab === "cliente" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Cliente *</label><input type="text" value={form.cliente || ""} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} style={inp} /></div>
                  {[["cnpj","CNPJ / CPF","text"],["contato_tel","Telefone","text"],["contato_email","E-mail","email"]].map(([k,l,t]) => (
                    <div key={k}><label style={lbl}>{l}</label><input type={t} value={form[k] || ""} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} /></div>
                  ))}
                </div>
              )}
              {modalTab === "financeiro" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1/-1", background: "#F8FAFC", borderRadius: 8, padding: 10, fontSize: 12, color: "#6B7280" }}>
                    💡 Informe o valor total ou calcule a partir de MO + Material.
                  </div>
                  {[["valor","Valor Total (R$) *","number"],["mao_de_obra","Estimativa Mão de Obra (R$)","number"],["material","Estimativa Material (R$)","number"],["bdi","BDI (%)","number"],["margem","Margem de Lucro (%)","number"]].map(([k,l,t]) => (
                    <div key={k}><label style={lbl}>{l}</label><input type={t} value={form[k] || ""} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} /></div>
                  ))}
                  {form.mao_de_obra && form.material && (
                    <div style={{ gridColumn: "1/-1", background: "#DCFCE7", borderRadius: 8, padding: 10, fontSize: 12, color: "#16A34A", fontWeight: 600 }}>
                      MO + Material = {fmt(Number(form.mao_de_obra) + Number(form.material))}
                    </div>
                  )}
                </div>
              )}
              {modalTab === "extras" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["art","Número da ART","text"],["contrato","Número do Contrato","text"]].map(([k,l,t]) => (
                    <div key={k}><label style={lbl}>{l}</label><input type={t} value={form[k] || ""} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} /></div>
                  ))}
                  <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Observações Internas</label><textarea value={form.observacoes || ""} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={5} style={{ ...inp, resize: "vertical" }} /></div>
                </div>
              )}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={{ background: saving ? "#94A3B8" : "#0F172A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 24px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14 }}>
                {saving ? "Salvando..." : modal === "novo" ? "Criar Orçamento" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
