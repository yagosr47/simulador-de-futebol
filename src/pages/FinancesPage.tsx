import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { getClubMonthlyFinancialSummary } from '../engine/economy';
import { formatCurrency, formatDateBR } from '../engine/constants';
import { Panel, StatCard } from '../components/UI';
import { ArrowDownCircle, ArrowUpCircle, Handshake, Landmark, TrendingUp, Wallet } from 'lucide-react';

const LOAN_OFFERS = [
  { bank: 'Banco Nacional Esportivo', amount: 10_000_000, months: 12, rate: 11.5 },
  { bank: 'Crédito Arena Capital', amount: 25_000_000, months: 24, rate: 13.0 },
  { bank: 'Fundo Sul-Americano Pro', amount: 45_000_000, months: 36, rate: 14.5 },
];

export const FinancesPage: React.FC = () => {
  const { state, userClub, userPlayers, takeClubLoan, switchSponsor } = useGame();
  const [txFilter, setTxFilter] = useState<'all' | 'receita' | 'despesa'>('all');

  const summary = useMemo(() => getClubMonthlyFinancialSummary(userClub, userPlayers), [userClub, userPlayers]);

  const transactions = useMemo(() => {
    return userClub.finances.transactions.filter((t) => txFilter === 'all' || t.type === txFilter);
  }, [userClub.finances.transactions, txFilter]);

  const totalReceitas = userClub.finances.transactions
    .filter((t) => t.type === 'receita')
    .reduce((a, t) => a + t.amount, 0);
  const totalDespesas = userClub.finances.transactions
    .filter((t) => t.type === 'despesa')
    .reduce((a, t) => a + t.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Finanças & Economia do Clube</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Controle salários, bilheteria, premiações, patrocínios, empréstimos, obras do estádio e despesas médicas.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Saldo Atual em Caixa"
          value={formatCurrency(userClub.finances.balance)}
          sub={`Projeção mensal: ${summary.projectedMonthlyNet >= 0 ? '+' : ''}${formatCurrency(summary.projectedMonthlyNet)}`}
          icon={<Wallet className="w-5 h-5" />}
          accent={userClub.finances.balance >= 0 ? 'emerald' : 'rose'}
        />
        <StatCard
          label="Orçamento de Transferências"
          value={formatCurrency(userClub.finances.transferBudget)}
          sub="Disponível para mercado e leilões"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="sky"
        />
        <StatCard
          label="Receitas Acumuladas"
          value={formatCurrency(totalReceitas)}
          sub={`Patrocínio: ${formatCurrency(summary.sponsorshipIncome)}/mês`}
          icon={<ArrowUpCircle className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Despesas Acumuladas"
          value={formatCurrency(totalDespesas)}
          sub={`Custo fixo mensal: ${formatCurrency(summary.totalMonthlyExpenses)}`}
          icon={<ArrowDownCircle className="w-5 h-5" />}
          accent="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Estrutura Mensal de Custos e Receitas */}
        <Panel title="Estrutura Mensal Recorrente" subtitle="Executada automaticamente no dia 1º de cada mês" className="lg:col-span-5">
          <div className="space-y-2.5 text-xs">
            <p className="text-[10px] font-bold uppercase text-emerald-400">Receitas Estimadas / Mês</p>
            <div className="flex justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25">
              <span>Patrocínio Master ({userClub.finances.sponsorship.sponsorName})</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(summary.sponsorshipIncome)}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25">
              <span>Bilheteria Estimada (~2 jogos em casa)</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrency(summary.estimatedMatchdayIncome)}
              </span>
            </div>

            <p className="text-[10px] font-bold uppercase text-rose-400 pt-2">Despesas Fixas / Mês</p>
            {[
              ['Salários dos Jogadores', summary.playerWages],
              ['Comissão Técnica', summary.coachWages],
              ['Equipe Médica', summary.medicalWages],
              ['Insumos & Despesas Médicas', summary.medicalSupplies],
              ['Manutenção do Estádio', summary.stadiumMaintenance],
              ['Parcelas de Empréstimos', summary.loanPayments],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="flex justify-between p-2 rounded-lg bg-[#0a101d] border border-slate-800/80"
              >
                <span className="text-slate-300">{label}</span>
                <span className="font-mono font-bold text-rose-300">-{formatCurrency(Number(val))}</span>
              </div>
            ))}

            <div className="flex justify-between pt-3 border-t border-slate-800 text-sm">
              <span className="font-bold text-white">Balanço Mensal Projetado</span>
              <span
                className={`font-mono font-black ${
                  summary.projectedMonthlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.projectedMonthlyNet >= 0 ? '+' : ''}
                {formatCurrency(summary.projectedMonthlyNet)}
              </span>
            </div>
          </div>
        </Panel>

        {/* Patrocínios & Empréstimos Bancários */}
        <div className="lg:col-span-7 space-y-6">
          <Panel
            title="Contratos de Patrocínio Master"
            subtitle={`Atual: ${userClub.finances.sponsorship.sponsorName} (${userClub.finances.sponsorship.tier}) • Reputação do clube: ${userClub.reputation}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {state.availableSponsors.map((sp) => {
                const isCurrent = userClub.finances.sponsorship.id === sp.id;
                const eligible = userClub.reputation >= sp.minReputation;
                return (
                  <div
                    key={sp.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                      isCurrent
                        ? 'bg-emerald-500/15 border-emerald-400/60'
                        : 'bg-[#0a101d] border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black text-white flex items-center gap-1.5">
                          <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                          {sp.sponsorName}
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                          {sp.tier}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                        {formatCurrency(sp.monthlyIncome)}/mês
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Bônus de título: {formatCurrency(sp.titleBonus)} • Rep mín: {sp.minReputation}
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="text-[11px] font-bold text-emerald-300">Patrocinador Atual</span>
                    ) : (
                      <button
                        onClick={() => switchSponsor(sp.id)}
                        disabled={!eligible}
                        className="w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-emerald-300 hover:text-white border border-emerald-500/40 disabled:border-slate-700 text-[11px] font-bold transition-colors"
                      >
                        {eligible ? 'Assinar Contrato (+Luvas)' : `Requer Reputação ${sp.minReputation}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Linhas de Crédito e Empréstimos Bancários"
            subtitle={`Empréstimos ativos: ${userClub.finances.loans.length}/3`}
          >
            {userClub.finances.loans.length > 0 && (
              <div className="mb-4 space-y-2">
                {userClub.finances.loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/35 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-amber-200">{loan.bankName}</p>
                      <p className="text-[11px] text-slate-400">
                        {loan.monthsRemaining} parcelas restantes • {formatCurrency(loan.monthlyPayment)}/mês
                      </p>
                    </div>
                    <span className="font-mono font-bold text-amber-300">
                      Restante: {formatCurrency(loan.remainingAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LOAN_OFFERS.map((offer) => (
                <div key={offer.bank} className="p-3 rounded-xl bg-[#0a101d] border border-slate-800 space-y-2">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-sky-400" />
                    {offer.bank}
                  </p>
                  <p className="text-sm font-mono font-black text-sky-300">{formatCurrency(offer.amount)}</p>
                  <p className="text-[10px] text-slate-400">
                    {offer.months} meses • Juros {offer.rate}% a.a.
                  </p>
                  <button
                    onClick={() => takeClubLoan(offer.amount, offer.months, offer.rate, offer.bank)}
                    disabled={userClub.finances.loans.length >= 3}
                    className="w-full py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-sky-300 hover:text-white border border-sky-500/40 text-[11px] font-bold transition-colors"
                  >
                    Contratar Crédito
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Extrato Completo */}
      <Panel
        title="Extrato Financeiro Detalhado"
        right={
          <div className="flex gap-1">
            {(['all', 'receita', 'despesa'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  txFilter === f ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'receita' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0e1525]">
              <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <th className="py-2 text-left">Data</th>
                <th className="py-2 text-left">Categoria</th>
                <th className="py-2 text-left">Descrição</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2.5 font-mono text-slate-400">{formatDateBR(tx.date)}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-200">
                      {tx.category}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-200">{tx.description}</td>
                  <td
                    className={`py-2.5 text-right font-mono font-bold tabular-nums ${
                      tx.type === 'receita' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.type === 'receita' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
