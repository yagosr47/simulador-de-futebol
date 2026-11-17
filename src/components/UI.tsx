import React from 'react';
import { Club, ContractRole, DissatisfactionLevel, Position } from '../types/game';
import { POSITION_GROUPS } from '../engine/constants';
import { X } from 'lucide-react';

export const ClubBadge: React.FC<{
  club?: Pick<Club, 'shortName' | 'primaryColor' | 'secondaryColor' | 'name'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = ({ club, size = 'md' }) => {
  const dims =
    size === 'xs'
      ? 'w-6 h-6 text-[9px]'
      : size === 'sm'
        ? 'w-8 h-8 text-[10px]'
        : size === 'lg'
          ? 'w-14 h-14 text-base'
          : 'w-10 h-10 text-xs';

  const bg = club?.primaryColor ?? '#10b981';
  const border = club?.secondaryColor ?? '#ffffff';

  return (
    <div
      className={`${dims} rounded-xl flex items-center justify-center font-black tracking-tight shrink-0 shadow-md select-none`}
      style={{
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        border: `2px solid ${border}88`,
        color: bg.toLowerCase() === '#f8fafc' || bg.toLowerCase() === '#ffffff' ? '#0f172a' : '#ffffff',
      }}
      title={club?.name}
    >
      {club?.shortName ?? 'FC'}
    </div>
  );
};

export const PositionBadge: React.FC<{ position: Position; size?: 'xs' | 'sm' }> = ({
  position,
  size = 'sm',
}) => {
  const group = POSITION_GROUPS[position];
  const colorClass =
    group === 'GOL'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : group === 'DEF'
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
        : group === 'MEI'
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-bold tracking-wide ${colorClass} ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {position}
    </span>
  );
};

export function getRatingColor(val: number): string {
  if (val >= 85) return 'text-emerald-400';
  if (val >= 76) return 'text-lime-400';
  if (val >= 68) return 'text-amber-300';
  if (val >= 58) return 'text-orange-400';
  return 'text-rose-400';
}

/**
 * Exibe atributo com modificador temporário visual, ex: 82 (-3) ou 79 (+2)
 */
export const AttributeValue: React.FC<{
  base: number;
  delta?: number;
  showBar?: boolean;
  label?: string;
}> = ({ base, delta = 0, showBar = false, label }) => {
  const eff = Math.max(1, Math.min(99, base + delta));
  return (
    <div className={label ? 'flex items-center justify-between gap-2 py-1' : 'inline-flex items-center gap-1'}>
      {label && <span className="text-xs text-slate-300 truncate">{label}</span>}
      <div className="flex items-center gap-2">
        {showBar && (
          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full rounded-full ${
                eff >= 80 ? 'bg-emerald-500' : eff >= 70 ? 'bg-lime-500' : eff >= 60 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${eff}%` }}
            />
          </div>
        )}
        <span className={`font-mono font-bold tabular-nums text-xs ${getRatingColor(eff)}`}>
          {base}
          {delta !== 0 && (
            <span className={`ml-1 text-[11px] font-semibold ${delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ({delta > 0 ? `+${delta}` : delta})
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export const OverallBadge: React.FC<{
  base: number;
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ base, delta = 0, size = 'sm' }) => {
  const eff = Math.max(1, Math.min(99, base + delta));
  const bg =
    eff >= 84
      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
      : eff >= 76
        ? 'bg-lime-500/15 border-lime-400/40 text-lime-300'
        : eff >= 68
          ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
          : 'bg-slate-700/50 border-slate-600 text-slate-300';

  const sizeCls =
    size === 'lg'
      ? 'px-3 py-1.5 text-xl'
      : size === 'md'
        ? 'px-2.5 py-1 text-sm'
        : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border font-mono font-black tabular-nums ${bg} ${sizeCls}`}>
      <span>{base}</span>
      {delta !== 0 && (
        <span className={`text-[10px] font-bold ${delta < 0 ? 'text-rose-400' : 'text-emerald-300'}`}>
          ({delta > 0 ? `+${delta}` : delta})
        </span>
      )}
    </span>
  );
};

export const DissatisfactionBadge: React.FC<{ level: DissatisfactionLevel }> = ({ level }) => {
  const map: Record<DissatisfactionLevel, string> = {
    Satisfeito: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Leve: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    Moderada: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Elevada: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[level]}`}>
      {level}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: ContractRole }> = ({ role }) => {
  const map: Record<ContractRole, string> = {
    'Titular fixo': 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
    'Titular rotativo': 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
    Volátil: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    Reserva: 'bg-slate-700/60 text-slate-300 border-slate-600',
    'Jovem promessa': 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${map[role]}`}>
      {role}
    </span>
  );
};

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  color?: 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo';
  invertDanger?: boolean;
  height?: string;
}> = ({ value, max = 100, color, invertDanger = false, height = 'h-2' }) => {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  let barColor = 'bg-emerald-500';
  if (color) {
    barColor =
      color === 'emerald'
        ? 'bg-emerald-500'
        : color === 'amber'
          ? 'bg-amber-400'
          : color === 'rose'
            ? 'bg-rose-500'
            : color === 'sky'
              ? 'bg-sky-400'
              : 'bg-indigo-400';
  } else if (invertDanger) {
    barColor = pct >= 70 ? 'bg-rose-500' : pct >= 45 ? 'bg-amber-400' : 'bg-emerald-500';
  } else {
    barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  }

  return (
    <div className={`w-full ${height} bg-slate-800/90 rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`bg-[#0e1525] border border-slate-800/90 rounded-2xl shadow-lg ${className}`}>
    {(title || right) && (
      <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div>
          {title && <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo';
  onClick?: () => void;
}> = ({ label, value, sub, icon, accent = 'emerald', onClick }) => {
  const accentRing =
    accent === 'emerald'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : accent === 'amber'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : accent === 'sky'
          ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
          : accent === 'rose'
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

  return (
    <div
      onClick={onClick}
      className={`bg-[#0e1525] border border-slate-800/90 rounded-2xl p-4 flex items-start justify-between gap-3 ${
        onClick ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-xl font-black text-white tabular-nums mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
      {icon && <div className={`p-2.5 rounded-xl border shrink-0 ${accentRing}`}>{icon}</div>}
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidth = 'max-w-2xl', children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} bg-[#0e1525] border border-slate-700/80 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
