import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ClipboardList, FileText, LineChart, Wallet, CalendarRange,
  Banknote, Users, Landmark, ShieldCheck, Bell, ChevronDown, User, LogOut, Menu, X,
} from "lucide-react";
import "./TopNav.css";

// Quién ve cada módulo — mismos permisos que tenía el menú anterior de App.js:
// Presupuesto, Finanzas y Dashboard Financiero: Administrador, Coordinadora y Gerente
// (puedeVerFinanzas en App.js); Colaboradores, Datos Bancarios, Pagos PAB y Auditoría: solo
// Administrador y Coordinadora Administrativa (las vistas en App.js vuelven a validar el rol,
// este menú solo decide qué botones se muestran).
const ADMIN = ["Administrador", "Coordinadora Administrativa"];
const TODOS = [...ADMIN, "Contadora", "Gerente", "Responsable", "Colaborador"];
const ROLES_FINANZAS = [...ADMIN, "Gerente"];

// `id` = valor de currentView en App.js.
const GRUPOS = [
  { label: "Inicio", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: TODOS },
  ]},
  { label: "Operación", items: [
    { id: "solicitudes", label: "Solicitudes", icon: ClipboardList, roles: TODOS },
    { id: "cuentasCobro", label: "Cuentas de cobro", icon: FileText, roles: TODOS },
  ]},
  { label: "Finanzas", items: [
    { id: "dashboardFinanciero", label: "Dashboard financiero", icon: LineChart, roles: ROLES_FINANZAS },
    { id: "finanzas", label: "Finanzas", icon: Wallet, roles: ROLES_FINANZAS },
    { id: "presupuesto", label: "Presupuesto", icon: CalendarRange, roles: ROLES_FINANZAS },
    { id: "pagosPAB", label: "Pagos PAB", icon: Banknote, roles: ADMIN },
  ]},
  { label: "Equipo", items: [
    { id: "responsables", label: "Colaboradores", icon: Users, roles: ADMIN },
    { id: "datosBancarios", label: "Datos bancarios", icon: Landmark, roles: ADMIN },
  ]},
  { label: "Control", items: [
    { id: "auditoria", label: "Auditoría", icon: ShieldCheck, roles: ADMIN },
  ]},
];

export default function TopNav({
  active, onNavigate, role, userName, notifCount = 0,
  badges = {}, onBellClick, bell, onLogout, logoSrc,
}) {
  const [open, setOpen] = useState(null);      // grupo desplegado
  const [userOpen, setUserOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const ref = useRef(null);

  const grupos = GRUPOS
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(role)) }))
    .filter(g => g.items.length);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(null); setUserOpen(false); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = id => { onNavigate(id); setOpen(null); setUserOpen(false); setMobile(false); };
  const iniciales = (userName || "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const grupoActivo = grupos.find(g => g.items.some(i => i.id === active))?.label;

  const Item = ({ it }) => {
    const Icon = it.icon;
    return (
      <button className={`tn-item ${active === it.id ? "on" : ""}`} onClick={() => go(it.id)}>
        <Icon size={16} /> <span>{it.label}</span>
        {badges[it.id] > 0 && <span className="tn-badge">{badges[it.id]}</span>}
      </button>
    );
  };

  return (
    <header className="tn" ref={ref}>
      <div className="tn-bar">
        <div className="tn-logo" onClick={() => go("dashboard")}>
          {logoSrc ? <img src={logoSrc} alt="AM Holding" /> : <span className="tn-mark">AM</span>}
        </div>

        <nav className="tn-groups">
          {grupos.map(g => g.items.length === 1 ? (
            <button key={g.label} className={`tn-group ${grupoActivo === g.label ? "on" : ""}`} onClick={() => go(g.items[0].id)}>
              {g.items[0].label === g.label ? g.label : g.items[0].label}
            </button>
          ) : (
            <div key={g.label} className="tn-dd">
              <button className={`tn-group ${grupoActivo === g.label ? "on" : ""}`}
                onClick={() => setOpen(open === g.label ? null : g.label)}>
                {g.label} <ChevronDown size={14} className={open === g.label ? "rot" : ""} />
              </button>
              {open === g.label && (
                <div className="tn-menu">{g.items.map(it => <Item key={it.id} it={it} />)}</div>
              )}
            </div>
          ))}
        </nav>

        <div className="tn-right">
          {/* `bell` = campana completa con su propio panel (NotificacionesCampana); si no se
              pasa, queda el botón simple con contador. */}
          {bell || (
            <button className="tn-bell" onClick={onBellClick} aria-label="Notificaciones">
              <Bell size={19} />
              {notifCount > 0 && <span className="tn-dot">{notifCount}</span>}
            </button>
          )}

          <div className="tn-dd">
            <button className="tn-user" onClick={() => setUserOpen(!userOpen)}>
              <span className="tn-avatar">{iniciales}</span>
              <span className="tn-uinfo"><b>{userName}</b><small>{role}</small></span>
              <ChevronDown size={14} />
            </button>
            {userOpen && (
              <div className="tn-menu tn-menu-right">
                <button className={`tn-item ${active === "mi-perfil" ? "on" : ""}`} onClick={() => go("mi-perfil")}><User size={16} /> Mi perfil</button>
                <button className="tn-item danger" onClick={onLogout}><LogOut size={16} /> Salir</button>
              </div>
            )}
          </div>

          <button className="tn-burger" onClick={() => setMobile(!mobile)} aria-label="Menú">
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobile && (
        <div className="tn-mobile">
          {grupos.map(g => (
            <div key={g.label}>
              <div className="tn-mlabel">{g.label}</div>
              {g.items.map(it => <Item key={it.id} it={it} />)}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
