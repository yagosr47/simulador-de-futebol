import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { CalendarEvent, CalendarEventType } from '../types/game';
import { formatDateBR } from '../engine/constants';
import { Panel } from '../components/UI';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, ArrowRight } from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const EVENT_COLORS: Record<CalendarEventType, string> = {
  partida: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  final: 'bg-amber-500/25 text-amber-200 border-amber-400/60',
  janela_abertura: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  janela_fechamento: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  treinamento: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  recuperacao: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  especial: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  contrato: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  obra: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  leilao: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
};

export const CalendarPage: React.FC = () => {
  const { state, navigate, advanceDays } = useGame();
  const [curYear, curMonth] = state.currentDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(curYear);
  const [viewMonth, setViewMonth] = useState(curMonth); // 1-12
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(state.currentDate);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of state.calendarEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [state.calendarEvents]);

  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    const startWeekday = firstDayUtc.getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    const cells: { dateStr: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(viewMonth).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateStr: `${viewYear}-${mm}-${dd}`, dayNum: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const dayEvents = eventsByDate[selectedDate] ?? [];

  const goToRelatedPage = (ev: CalendarEvent) => {
    if (ev.type === 'partida' || ev.type === 'final') navigate('matches');
    else if (ev.type === 'janela_abertura' || ev.type === 'janela_fechamento') navigate('transfers');
    else if (ev.type === 'treinamento' || ev.type === 'recuperacao') navigate('training');
    else if (ev.type === 'contrato') navigate('player_profile', ev.relatedId);
    else if (ev.type === 'obra') navigate('stadium');
    else if (ev.type === 'leilao') navigate('auctions');
    else navigate('finances');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Calendário da Temporada {state.season}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Clique em qualquer data ou evento para inspecionar detalhes de partidas, janelas, treinos, leilões, obras e contratos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => advanceDays(1)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
          >
            Avançar +1 Dia
          </button>
          <button
            onClick={() => advanceDays(7)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
          >
            Avançar +7 Dias (para se houver jogo)
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {(
          [
            ['partida', 'Partidas'],
            ['final', 'Finais'],
            ['janela_abertura', 'Abertura Janela'],
            ['janela_fechamento', 'Fechamento Janela'],
            ['treinamento', 'Treinamento'],
            ['recuperacao', 'Recuperação'],
            ['obra', 'Obras Estádio'],
            ['leilao', 'Leilões'],
            ['contrato', 'Contratos'],
          ] as [CalendarEventType, string][]
        ).map(([type, label]) => (
          <span key={type} className={`px-2.5 py-1 rounded-full border font-semibold ${EVENT_COLORS[type]}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Grade Mensal (8 cols) */}
        <Panel
          className="lg:col-span-8"
          title={`${MONTH_NAMES[viewMonth - 1]} de ${viewYear}`}
          right={
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrevMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setViewYear(curYear);
                  setViewMonth(curMonth);
                  setSelectedDate(state.currentDate);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300"
              >
                Hoje
              </button>
              <button
                onClick={goNextMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-bold uppercase text-slate-400 py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell.dateStr) {
                return <div key={`empty-${idx}`} className="min-h-[82px] rounded-xl bg-slate-950/30" />;
              }
              const evs = eventsByDate[cell.dateStr] ?? [];
              const isToday = cell.dateStr === state.currentDate;
              const isSelected = cell.dateStr === selectedDate;
              const isPast = cell.dateStr < state.currentDate;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    setSelectedDate(cell.dateStr!);
                    setSelectedEvent(evs[0] ?? null);
                  }}
                  className={`min-h-[82px] p-1.5 rounded-xl border cursor-pointer transition-all flex flex-col ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-400'
                      : isToday
                        ? 'bg-sky-500/15 border-sky-400/70'
                        : isPast
                          ? 'bg-[#090e1a] border-slate-800/60 opacity-75 hover:opacity-100'
                          : 'bg-[#0b1220] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        isToday ? 'text-sky-300' : 'text-slate-300'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {isToday && <span className="text-[9px] font-black text-sky-300 uppercase">Hoje</span>}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {evs.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr!);
                          setSelectedEvent(ev);
                        }}
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold truncate ${EVENT_COLORS[ev.type]}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {evs.length > 2 && (
                      <div className="text-[9px] text-slate-400 font-semibold pl-1">+{evs.length - 2} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Detalhes da Data / Evento Selecionado (4 cols) */}
        <Panel
          className="lg:col-span-4"
          title={`Agenda — ${formatDateBR(selectedDate)}`}
          subtitle={`${dayEvents.length} evento(s) nesta data`}
        >
          {dayEvents.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 space-y-2">
              <CalIcon className="w-8 h-8 text-slate-600 mx-auto" />
              <p>Nenhum evento oficial agendado neste dia.</p>
              <p className="text-[11px] text-slate-500">Dia livre ideal para comandar sessões de treinamento ou recuperação física.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map((ev) => {
                const isHighlighted = selectedEvent?.id === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isHighlighted
                        ? 'bg-[#121d33] border-emerald-400/70'
                        : 'bg-[#0a101d] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${EVENT_COLORS[ev.type]}`}>
                        {ev.badge ?? ev.type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{formatDateBR(ev.date)}</span>
                    </div>
                    <h3 className="text-sm font-black text-white">{ev.title}</h3>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{ev.description}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToRelatedPage(ev);
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      Ir para o módulo relacionado <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
