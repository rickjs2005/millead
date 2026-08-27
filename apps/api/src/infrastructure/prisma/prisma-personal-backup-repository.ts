import { Prisma, prisma } from "@millead/database";
import type {
  BackupRow,
  PersonalBackupRepository,
  RestoreCounts,
  VaultDump,
} from "../../domain/repositories/personal-backup-repository.js";

/**
 * Dump e restauração com `omit`, não com `select`.
 *
 * A diferença decide se o backup fica completo com o tempo. Com `select`,
 * acrescentar uma coluna ao schema e esquecer de acrescentá-la aqui faz o
 * backup sair **incompleto em silêncio** — e a pessoa descobre no dia em que
 * restaura, quando o dado já não existe mais. Com `omit`, a coluna nova entra
 * sozinha, e o modo de falhar vira "veio coisa demais".
 *
 * `vaultId` sai de todas: ele é o dono, não o dado, e é reescrito na
 * restauração a partir do Cofre de destino.
 */

const semVault = { vaultId: true } as const;

/**
 * Dinheiro vira string decimal com duas casas antes de sair.
 *
 * O Prisma devolve `Decimal`, não string, e isso quebrava de dois jeitos
 * diferentes:
 *
 * 1. **A planilha estourava com 500.** `csvMoney` chama `.replace()`, que
 *    `Decimal` não tem. O JSON escapava porque `JSON.stringify` chama o
 *    `toJSON()` do Decimal sozinho — ou seja, o mesmo dump quebrava num
 *    formato e passava no outro.
 * 2. **O `toJSON()` corta zero à direita**: `100.00` virava `"100"`. O mesmo
 *    problema da fase 7, agora num arquivo que a pessoa guarda por anos e
 *    abre numa planilha.
 *
 * `toFixed(2)` vale pra todas: **toda coluna Decimal do Cofre é escala 2** —
 * valores, percentuais de tolerância e de rateio. Se um dia entrar uma com
 * escala diferente, este é o ponto que precisa saber disso.
 */
export function normalizeDecimals<T>(value: T): T {
  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toFixed(2) as unknown as T;
  }
  if (value instanceof Date || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeDecimals) as unknown as T;
  }
  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(value)) {
    saida[chave] = normalizeDecimals(item);
  }
  return saida as T;
}

export class PrismaPersonalBackupRepository implements PersonalBackupRepository {
  async dump(vaultId: string): Promise<VaultDump> {
    const where = { vaultId };

    // Em paralelo: são leituras independentes, e serializar 13 consultas num
    // banco remoto (Supabase) somaria a latência de cada uma.
    const [
      categories,
      accounts,
      cards,
      merchants,
      statements,
      importBatches,
      subscriptions,
      transactions,
      rules,
      alerts,
      contacts,
      debts,
      businessSends,
    ] = await Promise.all([
      // Pais antes dos filhos: o `parent_id` é auto-referente com Restrict, e
      // inserir um filho antes do pai estoura a FK na restauração.
      prisma.personalCategory.findMany({
        where,
        omit: semVault,
        orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
      }),
      prisma.personalAccount.findMany({ where, omit: semVault }),
      prisma.personalCreditCard.findMany({ where, omit: semVault }),
      prisma.personalMerchant.findMany({
        where,
        omit: semVault,
        include: { aliases: { omit: { vaultId: true, merchantId: true } } },
      }),
      prisma.personalStatement.findMany({ where, omit: semVault }),
      prisma.personalImportBatch.findMany({ where, omit: semVault }),
      prisma.personalSubscription.findMany({ where, omit: semVault }),
      prisma.personalTransaction.findMany({
        where,
        omit: semVault,
        include: { splits: { omit: { vaultId: true, transactionId: true } } },
      }),
      prisma.personalClassificationRule.findMany({ where, omit: semVault }),
      prisma.personalSubscriptionAlert.findMany({ where, omit: semVault }),
      prisma.personalContact.findMany({ where, omit: semVault }),
      prisma.personalDebt.findMany({
        where,
        omit: semVault,
        include: { payments: { omit: { vaultId: true, debtId: true } } },
      }),
      prisma.personalBusinessAllocation.findMany({
        where,
        select: { transactionId: true, amount: true, createdAt: true },
      }),
    ]);

    return normalizeDecimals({
      categories: categories as unknown as BackupRow[],
      accounts: accounts as unknown as BackupRow[],
      cards: cards as unknown as BackupRow[],
      merchants: merchants as unknown as VaultDump["merchants"],
      statements: statements as unknown as BackupRow[],
      importBatches: importBatches as unknown as BackupRow[],
      subscriptions: subscriptions as unknown as BackupRow[],
      transactions: transactions as unknown as VaultDump["transactions"],
      rules: rules as unknown as BackupRow[],
      alerts: alerts as unknown as BackupRow[],
      contacts: contacts as unknown as BackupRow[],
      debts: debts as unknown as VaultDump["debts"],
      businessSends: businessSends as unknown as BackupRow[],
    });
  }

  async isEmpty(vaultId: string): Promise<boolean> {
    // As categorias padrão não contam: nascem com o Cofre, e a restauração as
    // substitui. Qualquer outra coisa significa que já existe história ali.
    const [contas, cartoes, fornecedores, movimentacoes, assinaturas, pessoas, regras, lotes] =
      await Promise.all([
        prisma.personalAccount.count({ where: { vaultId } }),
        prisma.personalCreditCard.count({ where: { vaultId } }),
        prisma.personalMerchant.count({ where: { vaultId } }),
        prisma.personalTransaction.count({ where: { vaultId } }),
        prisma.personalSubscription.count({ where: { vaultId } }),
        prisma.personalContact.count({ where: { vaultId } }),
        prisma.personalClassificationRule.count({ where: { vaultId } }),
        prisma.personalImportBatch.count({ where: { vaultId } }),
      ]);

    return (
      contas + cartoes + fornecedores + movimentacoes + assinaturas + pessoas + regras + lotes === 0
    );
  }

  /**
   * A ordem das inserções é a ordem das chaves estrangeiras.
   *
   * Não é preferência de estilo: `personal_transactions` aponta pra conta,
   * cartão, categoria, fornecedor, fatura, lote e assinatura. Inserir fora de
   * ordem estoura a FK e derruba a transação inteira — o que é o
   * comportamento certo, mas transformaria toda restauração num erro.
   *
   * Tudo dentro de um `$transaction`: uma restauração pela metade deixaria
   * movimentações órfãs, e a pessoa só descobriria semanas depois.
   */
  async restore(vaultId: string, dump: VaultDump): Promise<RestoreCounts> {
    return prisma.$transaction(
      async (tx) => {
        // As categorias padrão saem antes: nada as referencia ainda (o Cofre
        // está vazio), e as do backup ocupam o lugar delas com os ids
        // originais, que as movimentações esperam encontrar.
        await tx.personalCategory.deleteMany({ where: { vaultId } });

        const comVault = <T extends object>(rows: readonly T[]) =>
          rows.map((row) => ({ ...row, vaultId }));

        // Categorias uma a uma, na ordem em que vieram (pais primeiro): o
        // `createMany` não garante ordem de inserção, e o auto-relacionamento
        // exige que o pai já exista.
        for (const categoria of dump.categories) {
          await tx.personalCategory.create({ data: { ...categoria, vaultId } as never });
        }

        await tx.personalAccount.createMany({ data: comVault(dump.accounts) as never });
        await tx.personalCreditCard.createMany({ data: comVault(dump.cards) as never });

        const merchants = dump.merchants.map(({ aliases: _aliases, ...m }) => m);
        await tx.personalMerchant.createMany({ data: comVault(merchants) as never });
        const aliases = dump.merchants.flatMap((m) =>
          m.aliases.map((a) => ({ ...a, merchantId: m.id, vaultId })),
        );
        if (aliases.length) {
          await tx.personalMerchantAlias.createMany({ data: aliases as never });
        }

        await tx.personalStatement.createMany({ data: comVault(dump.statements) as never });
        await tx.personalImportBatch.createMany({ data: comVault(dump.importBatches) as never });
        await tx.personalSubscription.createMany({ data: comVault(dump.subscriptions) as never });

        const transactions = dump.transactions.map(({ splits: _splits, ...t }) => t);
        await tx.personalTransaction.createMany({ data: comVault(transactions) as never });
        const splits = dump.transactions.flatMap((t) =>
          t.splits.map((s) => ({ ...s, transactionId: t.id, vaultId })),
        );
        if (splits.length) {
          await tx.personalTransactionSplit.createMany({ data: splits as never });
        }

        await tx.personalClassificationRule.createMany({ data: comVault(dump.rules) as never });
        await tx.personalSubscriptionAlert.createMany({ data: comVault(dump.alerts) as never });
        await tx.personalContact.createMany({ data: comVault(dump.contacts) as never });

        const debts = dump.debts.map(({ payments: _payments, ...d }) => d);
        await tx.personalDebt.createMany({ data: comVault(debts) as never });
        const payments = dump.debts.flatMap((d) =>
          d.payments.map((p) => ({ ...p, debtId: d.id, vaultId })),
        );
        if (payments.length) {
          await tx.personalDebtPayment.createMany({ data: payments as never });
        }

        return {
          categorias: dump.categories.length,
          contas: dump.accounts.length,
          cartoes: dump.cards.length,
          fornecedores: dump.merchants.length,
          faturas: dump.statements.length,
          importacoes: dump.importBatches.length,
          assinaturas: dump.subscriptions.length,
          movimentacoes: dump.transactions.length,
          rateios: splits.length,
          regras: dump.rules.length,
          alertas: dump.alerts.length,
          pessoas: dump.contacts.length,
          dividas: dump.debts.length,
          baixas: payments.length,
          enviosIgnorados: dump.businessSends.length,
        };
      },
      // Restaurar um Cofre de anos são milhares de linhas num banco remoto; o
      // limite padrão de 5s derrubaria a transação no meio.
      { timeout: 120_000, maxWait: 20_000 },
    );
  }
}
