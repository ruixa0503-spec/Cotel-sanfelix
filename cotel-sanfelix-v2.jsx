import { useState, useEffect, useMemo } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// USUARIOS — Cambia los nombres y contraseñas aquí
// ══════════════════════════════════════════════════════════════════════════════
const USUARIOS = [
  { id: 1, usuario: "admin",    contrasena: "cotel2024",  nombre: "Administrador",  rol: "Admin" },
  { id: 2, usuario: "usuario1", contrasena: "correos1",   nombre: "Operador 1",     rol: "Operador" },
  { id: 3, usuario: "usuario2", contrasena: "correos2",   nombre: "Operador 2",     rol: "Operador" },
];

// ── Storage helpers ───────────────────────────────────────────────────────────
const KEYS = { paquetes: "cotel_paquetes_v2", clientes: "cotel_clientes_v2", sesion: "cotel_sesion" };

async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function save(key, data) {
  try { await window.storage.set(key, JSON.stringify(data)); } catch {}
}
async function del(key) {
  try { await window.storage.delete(key); } catch {}
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5).toUpperCase(); }
function hoy() { return new Date().toISOString().split("T")[0]; }
function fmt(d) {
  if (!d) return "—";
  const [y, m, dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}

const formVacio    = { nombre: "", apellido: "", celular: "", destino: "", tipo: "paquete", cantidad: 1, fechaIngreso: hoy(), observaciones: "" };
const clienteVacio = { nombre: "", apellido: "", celular: "", direccion: "" };

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [user, setUser]   = useState("");
  const [pass, setPass]   = useState("");
  const [error, setError] = useState("");
  const [show, setShow]   = useState(false);

  function intentarLogin() {
    const encontrado = USUARIOS.find(
      u => u.usuario === user.trim() && u.contrasena === pass
    );
    if (encontrado) {
      onLogin(encontrado);
    } else {
      setError("Usuario o contraseña incorrectos.");
      setTimeout(() => setError(""), 3000);
    }
  }

  return (
    <div style={LS.bg}>
      <div style={LS.card}>
        {/* Logo */}
        <div style={LS.logoWrap}>
          <div style={LS.logoIcon}>✉</div>
          <div style={LS.logoTitle}>COTEL SAN FÉLIX</div>
          <div style={LS.logoSub}>Sistema de Gestión Postal</div>
          <div style={LS.logoPais}>Chiriquí · Panamá</div>
        </div>

        {/* Formulario */}
        <div style={LS.form}>
          <div style={LS.formGroup}>
            <label style={LS.label}>👤 Usuario</label>
            <input
              style={LS.input}
              type="text"
              placeholder="Ingresa tu usuario"
              value={user}
              onChange={e => setUser(e.target.value)}
              onKeyDown={e => e.key === "Enter" && intentarLogin()}
              autoCapitalize="none"
            />
          </div>
          <div style={LS.formGroup}>
            <label style={LS.label}>🔒 Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...LS.input, paddingRight: 44 }}
                type={show ? "text" : "password"}
                placeholder="Ingresa tu contraseña"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && intentarLogin()}
              />
              <button style={LS.eyeBtn} onClick={() => setShow(s => !s)}>
                {show ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && <div style={LS.error}>⚠️ {error}</div>}

          <button style={LS.btnLogin} onClick={intentarLogin}>
            Iniciar sesión
          </button>
        </div>

        <div style={LS.footer}>
          Ministerio de Gobierno · Dirección de Correos y Telégrafos
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [sesion, setSesion]   = useState(null);
  const [iniciando, setIniciando] = useState(true);

  // Recuperar sesión guardada
  useEffect(() => {
    load(KEYS.sesion).then(s => {
      if (s) setSesion(s);
      setIniciando(false);
    });
  }, []);

  async function handleLogin(usuario) {
    setSesion(usuario);
    await save(KEYS.sesion, usuario);
  }

  async function handleLogout() {
    setSesion(null);
    await del(KEYS.sesion);
  }

  if (iniciando) return <div style={S.loading}><span style={{ fontSize: 48 }}>✉</span><br />Cargando...</div>;
  if (!sesion)   return <Login onLogin={handleLogin} />;

  return <Sistema sesion={sesion} onLogout={handleLogout} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA PRINCIPAL (solo visible si hay sesión)
// ══════════════════════════════════════════════════════════════════════════════
function Sistema({ sesion, onLogout }) {
  const [tab, setTab] = useState("paquetes");
  const [paquetes, setPaquetes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);

  const [modalPaq,     setModalPaq]     = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [confirmDel,   setConfirmDel]   = useState(null);
  const [modalRetiro,  setModalRetiro]  = useState(null);

  const [formPaq,     setFormPaq]     = useState(formVacio);
  const [formCliente, setFormCliente] = useState(clienteVacio);

  const [q,          setQ]          = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [qClientes,  setQClientes]  = useState("");
  const [qBusqueda,  setQBusqueda]  = useState("");

  const [fechaRetiro,  setFechaRetiro]  = useState(hoy());
  const [nombreRetira, setNombreRetira] = useState("");

  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    Promise.all([load(KEYS.paquetes), load(KEYS.clientes)]).then(([p, c]) => {
      setPaquetes(p || []); setClientes(c || []); setLoading(false);
    });
  }, []);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  // ── PAQUETES ──────────────────────────────────────────────────────────────
  const paqFiltrados = useMemo(() => {
    const ql = q.toLowerCase();
    return paquetes.filter(p => {
      const match = `${p.nombre} ${p.apellido} ${p.celular} ${p.destino} ${p.id}`.toLowerCase().includes(ql);
      const tipoOk   = filtroTipo   === "todos" || p.tipo === filtroTipo;
      const estadoOk = filtroEstado === "todos" || (filtroEstado === "pendiente" ? !p.entregado : p.entregado);
      return match && tipoOk && estadoOk;
    }).sort((a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso));
  }, [paquetes, q, filtroTipo, filtroEstado]);

  function abrirNuevoPaq() { setFormPaq({ ...formVacio, fechaIngreso: hoy() }); setEditId(null); setModalPaq(true); }
  function abrirEditarPaq(p) { setFormPaq({ ...p }); setEditId(p.id); setModalPaq(true); }

  async function guardarPaq() {
    if (!formPaq.nombre.trim() || !formPaq.apellido.trim() || !formPaq.celular.trim() || !formPaq.destino.trim()) {
      showToast("Completa todos los campos obligatorios.", "err"); return;
    }
    let updated;
    if (editId) {
      updated = paquetes.map(p => p.id === editId ? { ...formPaq, id: editId } : p);
      showToast("Registro actualizado ✓");
    } else {
      updated = [{ ...formPaq, id: genId(), entregado: false, fechaEntrega: "", quienRetiro: "", registradoPor: sesion.nombre }, ...paquetes];
      showToast("Paquete registrado ✓");
    }
    setPaquetes(updated); await save(KEYS.paquetes, updated); setModalPaq(false);
  }

  async function eliminarPaq(id) {
    const updated = paquetes.filter(p => p.id !== id);
    setPaquetes(updated); await save(KEYS.paquetes, updated);
    setConfirmDel(null); showToast("Registro eliminado.", "err");
  }

  function abrirRetiro(p) { setModalRetiro(p); setFechaRetiro(hoy()); setNombreRetira(""); }

  async function confirmarRetiro() {
    if (!nombreRetira.trim()) { showToast("Indica quién retira.", "err"); return; }
    const updated = paquetes.map(p => p.id === modalRetiro.id
      ? { ...p, entregado: true, fechaEntrega: fechaRetiro, quienRetiro: nombreRetira }
      : p);
    setPaquetes(updated); await save(KEYS.paquetes, updated);
    setModalRetiro(null); showToast(`Retiro registrado para ${modalRetiro.nombre} ✓`);
  }

  async function reabrirPaq(id) {
    const updated = paquetes.map(p => p.id === id ? { ...p, entregado: false, fechaEntrega: "", quienRetiro: "" } : p);
    setPaquetes(updated); await save(KEYS.paquetes, updated); showToast("Marcado como pendiente");
  }

  const stats = useMemo(() => ({
    total:     paquetes.length,
    pendientes: paquetes.filter(p => !p.entregado).length,
    entregados: paquetes.filter(p => p.entregado).length,
    paquetesN:  paquetes.filter(p => p.tipo === "paquete").length,
    cartas:     paquetes.filter(p => p.tipo === "carta").length,
  }), [paquetes]);

  // ── CLIENTES ──────────────────────────────────────────────────────────────
  const clientesFiltrados = useMemo(() => {
    const ql = qClientes.toLowerCase();
    return clientes
      .filter(c => `${c.nombre} ${c.apellido} ${c.celular} ${c.direccion}`.toLowerCase().includes(ql))
      .sort((a, b) => a.apellido.localeCompare(b.apellido));
  }, [clientes, qClientes]);

  function abrirNuevoCliente() { setFormCliente(clienteVacio); setEditId(null); setModalCliente(true); }
  function abrirEditarCliente(c) { setFormCliente({ ...c }); setEditId(c.id); setModalCliente(true); }

  async function guardarCliente() {
    if (!formCliente.nombre.trim() || !formCliente.apellido.trim() || !formCliente.celular.trim()) {
      showToast("Nombre, apellido y celular son obligatorios.", "err"); return;
    }
    let updated;
    if (editId) {
      updated = clientes.map(c => c.id === editId ? { ...formCliente, id: editId } : c);
      showToast("Cliente actualizado ✓");
    } else {
      updated = [{ ...formCliente, id: genId() }, ...clientes];
      showToast("Cliente registrado ✓");
    }
    setClientes(updated); await save(KEYS.clientes, updated); setModalCliente(false);
  }

  async function eliminarCliente(id) {
    const updated = clientes.filter(c => c.id !== id);
    setClientes(updated); await save(KEYS.clientes, updated);
    setConfirmDel(null); showToast("Cliente eliminado.", "err");
  }

  // ── BÚSQUEDA ──────────────────────────────────────────────────────────────
  const resultadosBusqueda = useMemo(() => {
    if (qBusqueda.length < 2) return [];
    const ql = qBusqueda.toLowerCase();
    return paquetes.filter(p => `${p.nombre} ${p.apellido} ${p.celular}`.toLowerCase().includes(ql));
  }, [paquetes, qBusqueda]);

  if (loading) return <div style={S.loading}><span style={{ fontSize: 48 }}>✉</span><br />Cargando...</div>;

  return (
    <div style={S.root}>
      {/* ── HEADER ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.brand}>
            <div style={S.brandIcon}>✉</div>
            <div>
              <div style={S.brandTitle}>COTEL SAN FÉLIX</div>
              <div style={S.brandSub}>Sistema de Gestión Postal · Chiriquí, Panamá</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={S.headerStats}>
              <div style={S.hStat}><span style={{ ...S.hDot, background: "#F59E0B" }} />{stats.pendientes} pendientes</div>
              <div style={S.hStat}><span style={{ ...S.hDot, background: "#10B981" }} />{stats.entregados} entregados</div>
            </div>
            {/* Usuario */}
            <div style={S.userBadge}>
              <span style={S.userAvatar}>{sesion.nombre[0]}</span>
              <span style={S.userName}>{sesion.nombre}</span>
              <button style={S.btnLogout} onClick={() => setConfirmLogout(true)} title="Cerrar sesión">🚪</button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={S.tabs}>
          {[
            { id: "paquetes",  label: "📦 Registro de Paquetes" },
            { id: "busqueda",  label: "🔍 Consulta Rápida" },
            { id: "clientes",  label: "👥 Directorio de Clientes" },
          ].map(t => (
            <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={S.main}>

        {/* ══ PAQUETES ══ */}
        {tab === "paquetes" && (
          <>
            <div style={S.statsRow}>
              {[
                { label: "Total",      val: stats.total,      color: "#1A3A6B", icon: "📋" },
                { label: "Pendientes", val: stats.pendientes, color: "#DC2626", icon: "⏳" },
                { label: "Entregados", val: stats.entregados, color: "#16A34A", icon: "✅" },
                { label: "Paquetes",   val: stats.paquetesN,  color: "#D97706", icon: "📦" },
                { label: "Cartas",     val: stats.cartas,     color: "#7C3AED", icon: "✉️" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderTop: `3px solid ${s.color}` }}>
                  <div style={S.statIcon}>{s.icon}</div>
                  <div style={{ ...S.statVal, color: s.color }}>{s.val}</div>
                  <div style={S.statLbl}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={S.toolbar}>
              <div style={S.searchWrap}>
                <span style={S.searchIco}>🔍</span>
                <input style={S.searchInput} placeholder="Buscar por nombre, celular, destino..." value={q} onChange={e => setQ(e.target.value)} />
                {q && <button style={S.clearBtn} onClick={() => setQ("")}>✕</button>}
              </div>
              <select style={S.sel} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos los tipos</option>
                <option value="paquete">Paquetes</option>
                <option value="carta">Cartas</option>
              </select>
              <select style={S.sel} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="entregado">Entregados</option>
              </select>
              <button style={S.btnPrimary} onClick={abrirNuevoPaq}>+ Nuevo Registro</button>
            </div>

            <div style={S.resultInfo}>{paqFiltrados.length} resultado{paqFiltrados.length !== 1 ? "s" : ""}</div>

            {paqFiltrados.length === 0 ? (
              <div style={S.empty}><div style={{ fontSize: 48 }}>📭</div><div>No hay registros que mostrar</div></div>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {["#ID","Cliente","Celular","Destino","Tipo","Cant.","Ingreso","Estado / Retiro","Acciones"].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paqFiltrados.map((p, i) => (
                      <tr key={p.id} style={{ ...S.tr, background: i % 2 === 0 ? "#fff" : "#F8FAFC", opacity: p.entregado ? 0.75 : 1 }}>
                        <td style={S.td}><span style={S.idBadge}>{p.id.slice(0,6)}</span></td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{p.nombre} {p.apellido}</td>
                        <td style={S.td}>{p.celular}</td>
                        <td style={S.td}>{p.destino}</td>
                        <td style={S.td}>
                          <span style={p.tipo === "carta" ? S.badgeCarta : S.badgePaq}>
                            {p.tipo === "carta" ? "✉ Carta" : "📦 Paquete"}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: "center", fontWeight: 700 }}>{p.cantidad}</td>
                        <td style={S.td}>{fmt(p.fechaIngreso)}</td>
                        <td style={S.td}>
                          {p.entregado ? (
                            <div>
                              <span style={S.badgeOk}>✓ Entregado</span>
                              <div style={S.retiroInfo}>📅 {fmt(p.fechaEntrega)}</div>
                              {p.quienRetiro && <div style={S.retiroInfo}>👤 {p.quienRetiro}</div>}
                            </div>
                          ) : (
                            <button style={S.btnRetiro} onClick={() => abrirRetiro(p)}>📋 Registrar retiro</button>
                          )}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button style={S.btnIco}    onClick={() => abrirEditarPaq(p)}  title="Editar">✏️</button>
                            {p.entregado && <button style={S.btnIcoWarn} onClick={() => reabrirPaq(p.id)} title="Reabrir">↩️</button>}
                            <button style={S.btnIcoDel} onClick={() => setConfirmDel({ tipo:"paq", id: p.id, nombre: `${p.nombre} ${p.apellido}` })} title="Eliminar">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══ BÚSQUEDA ══ */}
        {tab === "busqueda" && (
          <div style={S.busquedaWrap}>
            <div style={S.busquedaCard}>
              <div style={S.busquedaTitle}>🔍 Consulta Rápida de Paquetes</div>
              <div style={S.busquedaSub}>Ingresa el nombre o celular del cliente para saber si tiene paquetes disponibles</div>
              <div style={S.searchWrap}>
                <span style={S.searchIco}>🔍</span>
                <input
                  style={{ ...S.searchInput, fontSize: 16, padding: "14px 14px 14px 44px" }}
                  placeholder="Escribe nombre o número de celular..."
                  value={qBusqueda}
                  onChange={e => setQBusqueda(e.target.value)}
                  autoFocus
                />
                {qBusqueda && <button style={S.clearBtn} onClick={() => setQBusqueda("")}>✕</button>}
              </div>

              {qBusqueda.length >= 2 && (
                <div style={{ marginTop: 20 }}>
                  {resultadosBusqueda.length === 0 ? (
                    <div style={S.busquedaNoResult}>
                      <div style={{ fontSize: 40 }}>📭</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 8 }}>Sin paquetes encontrados</div>
                      <div style={{ color: "#888", marginTop: 4 }}>No hay registros para "{qBusqueda}"</div>
                    </div>
                  ) : (
                    resultadosBusqueda.map(p => (
                      <div key={p.id} style={{ ...S.resultCard, borderLeft: `4px solid ${p.entregado ? "#16A34A" : "#DC2626"}` }}>
                        <div style={S.resultHeader}>
                          <div>
                            <span style={S.resultNombre}>{p.nombre} {p.apellido}</span>
                            <span style={{ marginLeft: 10, color: "#888", fontSize: 13 }}>📱 {p.celular}</span>
                          </div>
                          <span style={p.entregado ? S.badgeOk : S.badgePend}>
                            {p.entregado ? "✓ Entregado" : "⏳ Pendiente"}
                          </span>
                        </div>
                        <div style={S.resultDetails}>
                          <span>{p.tipo === "carta" ? "✉ Carta" : "📦 Paquete"}</span>
                          <span>📍 {p.destino}</span>
                          <span>🔢 {p.cantidad} unidad{p.cantidad > 1 ? "es" : ""}</span>
                          <span>📅 Ingreso: {fmt(p.fechaIngreso)}</span>
                          {p.entregado && <span>✅ Entregado: {fmt(p.fechaEntrega)}</span>}
                          {p.quienRetiro && <span>👤 Retiró: {p.quienRetiro}</span>}
                        </div>
                        {!p.entregado && (
                          <button style={{ ...S.btnPrimary, marginTop: 10, fontSize: 13 }} onClick={() => abrirRetiro(p)}>
                            📋 Registrar retiro
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              {qBusqueda.length > 0 && qBusqueda.length < 2 && (
                <div style={{ textAlign: "center", color: "#aaa", marginTop: 20 }}>Escribe al menos 2 caracteres...</div>
              )}
            </div>
          </div>
        )}

        {/* ══ CLIENTES ══ */}
        {tab === "clientes" && (
          <>
            <div style={S.toolbar}>
              <div style={S.searchWrap}>
                <span style={S.searchIco}>🔍</span>
                <input style={S.searchInput} placeholder="Buscar cliente por nombre o celular..." value={qClientes} onChange={e => setQClientes(e.target.value)} />
                {qClientes && <button style={S.clearBtn} onClick={() => setQClientes("")}>✕</button>}
              </div>
              <button style={S.btnPrimary} onClick={abrirNuevoCliente}>+ Nuevo Cliente</button>
            </div>
            <div style={S.resultInfo}>{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""} registrado{clientesFiltrados.length !== 1 ? "s" : ""}</div>

            {clientesFiltrados.length === 0 ? (
              <div style={S.empty}><div style={{ fontSize: 48 }}>👥</div><div>No hay clientes registrados</div></div>
            ) : (
              <div style={S.clientesGrid}>
                {clientesFiltrados.map(c => {
                  const pendientes = paquetes.filter(p => p.celular === c.celular && !p.entregado);
                  return (
                    <div key={c.id} style={S.clienteCard}>
                      <div style={S.clienteAvatar}>{c.nombre[0]}{c.apellido[0]}</div>
                      <div style={S.clienteInfo}>
                        <div style={S.clienteNombre}>{c.nombre} {c.apellido}</div>
                        <div style={S.clienteDetalle}>📱 {c.celular}</div>
                        {c.direccion && <div style={S.clienteDetalle}>📍 {c.direccion}</div>}
                        {pendientes.length > 0 && (
                          <div style={S.clientePaqBadge}>📦 {pendientes.length} paquete{pendientes.length > 1 ? "s" : ""} pendiente{pendientes.length > 1 ? "s" : ""}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button style={S.btnIco}    onClick={() => abrirEditarCliente(c)}>✏️</button>
                        <button style={S.btnIcoDel} onClick={() => setConfirmDel({ tipo:"cliente", id: c.id, nombre: `${c.nombre} ${c.apellido}` })}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ══ MODAL: NUEVO/EDITAR PAQUETE ══ */}
      {modalPaq && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalPaq(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <span style={S.modalTitle}>{editId ? "✏️ Editar Registro" : "📦 Nuevo Registro de Paquete"}</span>
              <button style={S.closeBtn} onClick={() => setModalPaq(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.formRow}>
                <Field label="Nombre *"   value={formPaq.nombre}   onChange={v => setFormPaq(f=>({...f,nombre:v}))}   placeholder="Nombre del destinatario" />
                <Field label="Apellido *" value={formPaq.apellido} onChange={v => setFormPaq(f=>({...f,apellido:v}))} placeholder="Apellido" />
              </div>
              <div style={S.formRow}>
                <Field label="Celular *"          value={formPaq.celular}  onChange={v => setFormPaq(f=>({...f,celular:v}))}  placeholder="6XXX-XXXX" type="tel" />
                <Field label="Lugar de destino *" value={formPaq.destino}  onChange={v => setFormPaq(f=>({...f,destino:v}))}  placeholder="Ej: Remedios, Chiriquí" />
              </div>
              <div style={S.formRow}>
                <div style={S.formGroup}>
                  <label style={S.label}>Tipo *</label>
                  <select style={S.selectField} value={formPaq.tipo} onChange={e => setFormPaq(f=>({...f,tipo:e.target.value}))}>
                    <option value="paquete">📦 Paquete</option>
                    <option value="carta">✉ Carta</option>
                  </select>
                </div>
                <Field label="Cantidad" value={formPaq.cantidad} onChange={v => setFormPaq(f=>({...f,cantidad:Number(v)}))} type="number" min={1} />
                <Field label="Fecha de ingreso *" value={formPaq.fechaIngreso} onChange={v => setFormPaq(f=>({...f,fechaIngreso:v}))} type="date" />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Observaciones</label>
                <textarea style={{ ...S.inputField, height: 70, resize: "vertical" }} value={formPaq.observaciones} onChange={e => setFormPaq(f=>({...f,observaciones:e.target.value}))} placeholder="Notas adicionales (opcional)" />
              </div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnSecondary} onClick={() => setModalPaq(false)}>Cancelar</button>
              <button style={S.btnPrimary}   onClick={guardarPaq}>{editId ? "Guardar cambios" : "Registrar paquete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: RETIRO ══ */}
      {modalRetiro && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalRetiro(null)}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={{ ...S.modalHead, background: "linear-gradient(135deg,#065F46,#047857)" }}>
              <span style={S.modalTitle}>📋 Registrar Retiro</span>
              <button style={S.closeBtn} onClick={() => setModalRetiro(null)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: "#065F46" }}>{modalRetiro.nombre} {modalRetiro.apellido}</div>
                <div style={{ color: "#166534", fontSize: 13 }}>📱 {modalRetiro.celular} · 📍 {modalRetiro.destino}</div>
                <div style={{ color: "#166534", fontSize: 13 }}>📦 {modalRetiro.cantidad} unidad{modalRetiro.cantidad > 1 ? "es" : ""} · Ingresó: {fmt(modalRetiro.fechaIngreso)}</div>
              </div>
              <Field label="¿Quién retira?" value={nombreRetira} onChange={setNombreRetira} placeholder="Nombre completo de quien retira" />
              <Field label="Fecha de retiro" value={fechaRetiro} onChange={setFechaRetiro} type="date" />
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnSecondary} onClick={() => setModalRetiro(null)}>Cancelar</button>
              <button style={{ ...S.btnPrimary, background: "#16A34A" }} onClick={confirmarRetiro}>✅ Confirmar retiro</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CLIENTE ══ */}
      {modalCliente && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalCliente(false)}>
          <div style={{ ...S.modal, maxWidth: 480 }}>
            <div style={{ ...S.modalHead, background: "linear-gradient(135deg,#4C1D95,#6D28D9)" }}>
              <span style={S.modalTitle}>{editId ? "✏️ Editar Cliente" : "👤 Nuevo Cliente"}</span>
              <button style={S.closeBtn} onClick={() => setModalCliente(false)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.formRow}>
                <Field label="Nombre *"   value={formCliente.nombre}   onChange={v => setFormCliente(f=>({...f,nombre:v}))}   placeholder="Nombre" />
                <Field label="Apellido *" value={formCliente.apellido} onChange={v => setFormCliente(f=>({...f,apellido:v}))} placeholder="Apellido" />
              </div>
              <Field label="Celular *"   value={formCliente.celular}   onChange={v => setFormCliente(f=>({...f,celular:v}))}   placeholder="6XXX-XXXX" type="tel" />
              <Field label="Dirección / Comunidad" value={formCliente.direccion} onChange={v => setFormCliente(f=>({...f,direccion:v}))} placeholder="Ej: Remedios, Chiriquí" />
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnSecondary} onClick={() => setModalCliente(false)}>Cancelar</button>
              <button style={{ ...S.btnPrimary, background: "#7C3AED" }} onClick={guardarCliente}>{editId ? "Guardar cambios" : "Registrar cliente"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CONFIRMAR ELIMINACIÓN ══ */}
      {confirmDel && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 380 }}>
            <div style={{ ...S.modalHead, background: "linear-gradient(135deg,#7F1D1D,#DC2626)" }}>
              <span style={S.modalTitle}>⚠️ Confirmar eliminación</span>
            </div>
            <div style={{ ...S.modalBody, textAlign: "center", paddingTop: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>¿Eliminar a <strong>{confirmDel.nombre}</strong>?</div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>Esta acción no se puede deshacer.</div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnSecondary} onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button style={{ ...S.btnPrimary, background: "#DC2626" }} onClick={() => confirmDel.tipo === "paq" ? eliminarPaq(confirmDel.id) : eliminarCliente(confirmDel.id)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CERRAR SESIÓN ══ */}
      {confirmLogout && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 360 }}>
            <div style={{ ...S.modalHead, background: "linear-gradient(135deg,#1A3A6B,#0D2147)" }}>
              <span style={S.modalTitle}>🚪 Cerrar sesión</span>
            </div>
            <div style={{ ...S.modalBody, textAlign: "center", paddingTop: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>¿Deseas cerrar la sesión de <strong>{sesion.nombre}</strong>?</div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btnSecondary} onClick={() => setConfirmLogout(false)}>Cancelar</button>
              <button style={S.btnPrimary}   onClick={onLogout}>Sí, cerrar sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === "err" ? "#DC2626" : "#16A34A" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text", min }) {
  return (
    <div style={S.formGroup}>
      <label style={S.label}>{label}</label>
      <input style={S.inputField} type={type} value={value} min={min} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const LS = {
  bg: { minHeight: "100vh", background: "linear-gradient(135deg,#0D2147 0%,#1A3A6B 50%,#1e4d8c 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI',system-ui,sans-serif" },
  card: { background: "#fff", borderRadius: 20, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.4)", overflow: "hidden" },
  logoWrap: { background: "linear-gradient(135deg,#0D2147,#1A3A6B)", color: "#fff", padding: "36px 32px 28px", textAlign: "center" },
  logoIcon: { fontSize: 52, marginBottom: 10 },
  logoTitle: { fontSize: 22, fontWeight: 800, letterSpacing: 2 },
  logoSub: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  logoPais: { fontSize: 11, opacity: 0.65, marginTop: 4, letterSpacing: 1 },
  form: { padding: "28px 28px 20px" },
  formGroup: { marginBottom: 18 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { width: "100%", padding: "12px 14px", border: "2px solid #E2E8F0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", background: "#FAFBFF" },
  eyeBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18 },
  error: { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 14 },
  btnLogin: { width: "100%", background: "#CC0000", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(204,0,0,0.3)" },
  footer: { background: "#F8FAFC", padding: "14px 28px", textAlign: "center", fontSize: 11, color: "#94A3B8", borderTop: "1px solid #E2E8F0" },
};

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS SISTEMA
// ══════════════════════════════════════════════════════════════════════════════
const S = {
  root: { minHeight: "100vh", background: "#F0F4F8", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#1A202C" },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 20, color: "#1A3A6B", gap: 12 },

  header: { background: "linear-gradient(135deg,#0D2147 0%,#1A3A6B 60%,#1e4d8c 100%)", color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 0", flexWrap: "wrap", gap: 12 },
  brand: { display: "flex", alignItems: "center", gap: 14 },
  brandIcon: { fontSize: 32, background: "rgba(255,255,255,0.15)", borderRadius: 12, width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center" },
  brandTitle: { fontSize: 20, fontWeight: 800, letterSpacing: 1 },
  brandSub: { fontSize: 11, opacity: 0.75, marginTop: 2 },
  headerStats: { display: "flex", gap: 14 },
  hStat: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: 0.9 },
  hDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },

  userBadge: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", borderRadius: 30, padding: "6px 12px 6px 6px" },
  userAvatar: { width: 28, height: 28, borderRadius: "50%", background: "#CC0000", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 13, fontWeight: 600, color: "#fff" },
  btnLogout: { background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 14, color: "#fff" },

  tabs: { display: "flex", padding: "10px 24px 0", overflowX: "auto", gap: 0 },
  tab: { padding: "10px 18px", background: "transparent", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13, fontWeight: 600, borderRadius: "8px 8px 0 0", whiteSpace: "nowrap" },
  tabActive: { background: "#F0F4F8", color: "#1A3A6B" },

  main: { padding: "22px", maxWidth: 1400, margin: "0 auto" },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 18 },
  statCard: { background: "#fff", borderRadius: 12, padding: "14px 10px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statVal: { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 10, color: "#666", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },

  toolbar: { display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" },
  searchWrap: { flex: 1, minWidth: 220, position: "relative", display: "flex", alignItems: "center" },
  searchIco: { position: "absolute", left: 13, fontSize: 14, pointerEvents: "none" },
  searchInput: { width: "100%", padding: "11px 34px 11px 38px", border: "2px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" },
  clearBtn: { position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14 },
  sel: { padding: "11px 12px", border: "2px solid #E2E8F0", borderRadius: 10, fontSize: 13, background: "#fff", cursor: "pointer", outline: "none" },

  resultInfo: { fontSize: 12, color: "#888", marginBottom: 10, fontStyle: "italic" },

  tableWrap: { background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "linear-gradient(135deg,#0D2147,#1A3A6B)", color: "#fff" },
  th: { padding: "12px 11px", textAlign: "left", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #EEF0F6" },
  td: { padding: "11px 11px", verticalAlign: "middle" },
  idBadge: { background: "#EEF2FF", color: "#3B5BDB", padding: "3px 7px", borderRadius: 6, fontFamily: "monospace", fontSize: 11, fontWeight: 700 },

  badgeCarta: { background: "#EFF6FF", color: "#1A3A6B", padding: "3px 9px", borderRadius: 20, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" },
  badgePaq:   { background: "#FFFBEB", color: "#B45309", padding: "3px 9px", borderRadius: 20, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" },
  badgeOk:    { background: "#F0FDF4", color: "#16A34A", padding: "3px 9px", borderRadius: 20, fontWeight: 600, fontSize: 11, border: "1px solid #BBF7D0", whiteSpace: "nowrap" },
  badgePend:  { background: "#FEF2F2", color: "#DC2626", padding: "3px 9px", borderRadius: 20, fontWeight: 600, fontSize: 11, border: "1px solid #FECACA", whiteSpace: "nowrap" },

  retiroInfo: { fontSize: 11, color: "#666", marginTop: 3 },
  btnRetiro:  { background: "#EFF6FF", color: "#1A3A6B", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 },

  btnIco:     { background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13 },
  btnIcoWarn: { background: "#FFFBEB", border: "none", borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13 },
  btnIcoDel:  { background: "#FEF2F2", border: "none", borderRadius: 8, padding: "6px 9px", cursor: "pointer", fontSize: 13 },

  empty: { textAlign: "center", padding: "60px 20px", color: "#888", fontSize: 16, background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" },

  btnPrimary:   { background: "#CC0000", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(204,0,0,0.25)" },
  btnSecondary: { background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  busquedaWrap:    { display: "flex", justifyContent: "center", paddingTop: 20 },
  busquedaCard:    { background: "#fff", borderRadius: 16, padding: "30px 26px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", width: "100%", maxWidth: 700 },
  busquedaTitle:   { fontSize: 20, fontWeight: 800, color: "#1A3A6B", marginBottom: 6 },
  busquedaSub:     { color: "#64748B", fontSize: 13, marginBottom: 18 },
  busquedaNoResult:{ textAlign: "center", padding: "32px 0", color: "#888" },
  resultCard:      { background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", marginBottom: 12 },
  resultHeader:    { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  resultNombre:    { fontWeight: 700, fontSize: 15, color: "#1A202C" },
  resultDetails:   { display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: "#555" },

  clientesGrid:    { display: "flex", flexDirection: "column", gap: 10 },
  clienteCard:     { background: "#fff", borderRadius: 12, padding: "13px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 13 },
  clienteAvatar:   { width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#1A3A6B,#4C1D95)", color: "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clienteInfo:     { flex: 1 },
  clienteNombre:   { fontWeight: 700, fontSize: 15 },
  clienteDetalle:  { fontSize: 12, color: "#64748B", marginTop: 2 },
  clientePaqBadge: { display: "inline-block", marginTop: 5, background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #FDE68A" },

  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 },
  modal:      { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, boxShadow: "0 24px 60px rgba(0,0,0,0.35)", overflow: "hidden", maxHeight: "95vh", overflowY: "auto" },
  modalHead:  { background: "linear-gradient(135deg,#0D2147,#1A3A6B)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 16, fontWeight: 700 },
  closeBtn:   { background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBody:  { padding: "20px 20px 8px" },
  modalFoot:  { padding: "12px 20px 20px", display: "flex", justifyContent: "flex-end", gap: 10 },

  formRow:     { display: "flex", gap: 12, flexWrap: "wrap" },
  formGroup:   { flex: 1, display: "flex", flexDirection: "column", gap: 5, marginBottom: 14, minWidth: 130 },
  label:       { fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.4 },
  inputField:  { padding: "10px 12px", border: "2px solid #E2E8F0", borderRadius: 9, fontSize: 14, outline: "none", background: "#FAFBFF", width: "100%", boxSizing: "border-box" },
  selectField: { padding: "10px 12px", border: "2px solid #E2E8F0", borderRadius: 9, fontSize: 14, outline: "none", background: "#FAFBFF", width: "100%", boxSizing: "border-box" },

  toast: { position: "fixed", bottom: 22, right: 22, color: "#fff", padding: "13px 18px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 6px 24px rgba(0,0,0,0.25)", zIndex: 9999 },
};
