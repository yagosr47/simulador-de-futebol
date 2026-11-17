import {
  BankLoan,
  Club,
  FinancialTransaction,
  Player,
  SponsorshipDeal,
} from '../types/game';
import { clamp } from './constants';

export function recordTransaction(
  club: Club,
  date: string,
  type: 'receita' | 'despesa',
  category: FinancialTransaction['category'],
  description: string,
  amount: number,
  affectTransferBudget = false,
): Club {
  const cleanAmount = Math.max(0, Math.round(amount));
  if (cleanAmount === 0) return club;

  const delta = type === 'receita' ? cleanAmount : -cleanAmount;
  const nextBalance = club.finances.balance + delta;
  const nextTransferBudget = affectTransferBudget
    ? Math.max(0, club.finances.transferBudget + delta)
    : Math.min(club.finances.transferBudget, Math.max(0, nextBalance * 0.85));

  const tx: FinancialTransaction = {
    id: `tx-${club.id}-${date}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    type,
    category,
    description,
    amount: cleanAmount,
  };

  return {
    ...club,
    finances: {
      ...club.finances,
      balance: nextBalance,
      transferBudget: Math.round(nextTransferBudget),
      transactions: [tx, ...club.finances.transactions].slice(0, 120),
    },
  };
}

export function getClubMonthlyFinancialSummary(
  club: Club,
  clubPlayers: Player[],
): {
  playerWages: number;
  coachWages: number;
  medicalWages: number;
  stadiumMaintenance: number;
  medicalSupplies: number;
  loanPayments: number;
  totalMonthlyExpenses: number;
  sponsorshipIncome: number;
  estimatedMatchdayIncome: number;
  projectedMonthlyNet: number;
} {
  const playerWages = clubPlayers.reduce((a, p) => a + p.contract.salary, 0);
  const coachWages = club.coaches.reduce((a, c) => a + c.monthlySalary, 0);
  const medicalWages = club.medicalStaff.reduce((a, m) => a + m.monthlySalary, 0);
  const injuredCount = clubPlayers.filter((p) => p.injury).length;
  const medicalSupplies = 45_000 + injuredCount * 35_000;
  const stadiumMaintenance = club.stadium.maintenanceMonthlyCost;
  const loanPayments = club.finances.loans.reduce((a, l) => a + l.monthlyPayment, 0);

  const totalMonthlyExpenses =
    playerWages + coachWages + medicalWages + stadiumMaintenance + medicalSupplies + loanPayments;

  const sponsorshipIncome = club.finances.sponsorship.monthlyIncome;
  // Estimativa de 2 jogos em casa por mês
  const avgGameRevenue =
    club.stadium.lastRevenue > 0
      ? club.stadium.lastRevenue
      : Math.round(club.stadium.capacity * 0.55 * club.stadium.ticketPrice);
  const estimatedMatchdayIncome = avgGameRevenue * 2;

  return {
    playerWages,
    coachWages,
    medicalWages,
    stadiumMaintenance,
    medicalSupplies,
    loanPayments,
    totalMonthlyExpenses,
    sponsorshipIncome,
    estimatedMatchdayIncome,
    projectedMonthlyNet: sponsorshipIncome + estimatedMatchdayIncome - totalMonthlyExpenses,
  };
}

export function processMonthlyFinances(
  club: Club,
  clubPlayers: Player[],
  currentDate: string,
): Club {
  const summary = getClubMonthlyFinancialSummary(club, clubPlayers);
  let next = club;

  // Receita de patrocínio
  next = recordTransaction(
    next,
    currentDate,
    'receita',
    'Patrocínio',
    `Parcela mensal — ${next.finances.sponsorship.sponsorName}`,
    summary.sponsorshipIncome,
  );

  // Salários do elenco
  next = recordTransaction(
    next,
    currentDate,
    'despesa',
    'Salários',
    `Folha salarial do elenco (${clubPlayers.length} atletas)`,
    summary.playerWages,
  );

  // Salários da comissão técnica e médica
  const staffTotal = summary.coachWages + summary.medicalWages;
  if (staffTotal > 0) {
    next = recordTransaction(
      next,
      currentDate,
      'despesa',
      'Funcionários',
      `Comissão técnica (${next.coaches.length}) e departamento médico (${next.medicalStaff.length})`,
      staffTotal,
    );
  }

  // Despesas médicas extras
  next = recordTransaction(
    next,
    currentDate,
    'despesa',
    'Departamento Médico',
    'Insumos clínicos, exames e reabilitação',
    summary.medicalSupplies,
  );

  // Manutenção do estádio
  next = recordTransaction(
    next,
    currentDate,
    'despesa',
    'Manutenção',
    `Operação e manutenção — ${next.stadium.name}`,
    summary.stadiumMaintenance,
  );

  // Parcelas de empréstimos bancários
  const updatedLoans: BankLoan[] = [];
  for (const loan of next.finances.loans) {
    next = recordTransaction(
      next,
      currentDate,
      'despesa',
      'Empréstimos',
      `Parcela bancária — ${loan.bankName}`,
      loan.monthlyPayment,
    );
    const remMonths = loan.monthsRemaining - 1;
    const remAmount = Math.max(0, loan.remainingAmount - loan.monthlyPayment);
    if (remMonths > 0 && remAmount > 1000) {
      updatedLoans.push({
        ...loan,
        monthsRemaining: remMonths,
        remainingAmount: remAmount,
      });
    }
  }

  // Atualiza duração do patrocínio
  const nextMonthsRem = Math.max(1, next.finances.sponsorship.monthsRemaining - 1);

  next = {
    ...next,
    finances: {
      ...next.finances,
      loans: updatedLoans,
      sponsorship: {
        ...next.finances.sponsorship,
        monthsRemaining: nextMonthsRem,
      },
      // Recompõe orçamento de transferências se houver folga em caixa
      transferBudget: Math.max(
        0,
        Math.round(Math.min(next.finances.balance * 0.65, Math.max(next.finances.transferBudget, next.finances.balance * 0.45))),
      ),
    },
  };

  return next;
}

export function takeBankLoan(
  club: Club,
  principal: number,
  months: number,
  interestRateAnnual: number,
  bankName: string,
  currentDate: string,
): Club {
  const totalWithInterest = Math.round(principal * (1 + (interestRateAnnual / 100) * (months / 12)));
  const monthlyPayment = Math.round(totalWithInterest / months);

  const loan: BankLoan = {
    id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bankName,
    principal,
    remainingAmount: totalWithInterest,
    monthlyPayment,
    interestRate: interestRateAnnual,
    monthsRemaining: months,
  };

  let next = recordTransaction(
    club,
    currentDate,
    'receita',
    'Empréstimos',
    `Empréstimo aprovado — ${bankName} (${months}x)`,
    principal,
    true,
  );

  next = {
    ...next,
    finances: {
      ...next.finances,
      loans: [...next.finances.loans, loan],
    },
  };

  return next;
}

export function signSponsorship(club: Club, deal: SponsorshipDeal, currentDate: string): Club {
  // Bônus de assinatura de 1 mês adiantado
  let next: Club = {
    ...club,
    finances: {
      ...club.finances,
      sponsorship: { ...deal },
    },
  };
  next = recordTransaction(
    next,
    currentDate,
    'receita',
    'Patrocínio',
    `Luvas de novo patrocínio — ${deal.sponsorName}`,
    Math.round(deal.monthlyIncome * 0.6),
  );
  return {
    ...next,
    popularity: clamp(next.popularity + (deal.tier === 'Global' ? 4 : deal.tier === 'Continental' ? 2 : 1), 30, 100),
  };
}
