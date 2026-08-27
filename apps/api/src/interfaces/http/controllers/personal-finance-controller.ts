import type { Request, Response } from "express";
import type {
  AddAliasBody,
  CreateAccountBody,
  CreateCardBody,
  CreateCategoryBody,
  CreateMerchantBody,
  CreateTransactionBody,
  CreateTransferBody,
  ListQuery,
  PayStatementBody,
  ReplaceSplitsBody,
  StatementQuery,
  TransactionQuery,
  UpdateAccountBody,
  UpdateCardBody,
  UpdateCategoryBody,
  UpdateMerchantBody,
  UpdateTransactionBody,
} from "../../../application/dto/personal-finance.dto.js";
import type {
  ConfirmImportBody,
  CreateImportProfileBody,
  ImportHistoryQuery,
  PreviewImportBody,
  UpdateImportProfileBody,
} from "../../../application/dto/personal-import.dto.js";
import type {
  ClassificationRunBody,
  CorrectClassificationBody,
  CreateRuleBody,
  UpdateRuleBody,
} from "../../../application/dto/personal-classification.dto.js";
import type {
  CreateSubscriptionBody,
  SnoozeAlertBody,
  SubscriptionQuery,
  UpdateSubscriptionBody,
} from "../../../application/dto/personal-subscription.dto.js";
import type {
  AddPaymentBody,
  ContactQuery,
  CreateContactBody,
  CreateDebtBody,
  DebtQuery,
  UpdateContactBody,
  UpdateDebtBody,
} from "../../../application/dto/personal-debt.dto.js";
import type { PersonalAccountService } from "../../../application/services/personal-account-service.js";
import type { PersonalClassificationService } from "../../../application/services/personal-classification-service.js";
import {
  todayUtc,
  type PersonalSubscriptionService,
} from "../../../application/services/personal-subscription-service.js";
import type { PersonalImportService } from "../../../application/services/personal-import-service.js";
import type { PersonalCatalogService } from "../../../application/services/personal-catalog-service.js";
import type { PersonalDebtService } from "../../../application/services/personal-debt-service.js";
import type { PersonalTransactionService } from "../../../application/services/personal-transaction-service.js";
import { parseMoney } from "../../../application/services/vault-money.js";
import { requireAuth } from "../require-auth.js";
import { requireVaultContext } from "../require-vault-context.js";

/**
 * Um controller para o núcleo inteiro do Cofre, em vez de quatro finos.
 *
 * Todos os métodos fazem exatamente a mesma coisa — pegam o `vaultId` de
 * `req.vault` e delegam — e o valor deles está justamente em serem idênticos:
 * é ler uma tela e ver que **nenhum** lê id de dono do corpo da requisição.
 * Espalhado em quatro arquivos, essa propriedade some de vista.
 */
export class PersonalFinanceController {
  constructor(
    private readonly accounts: PersonalAccountService,
    private readonly catalog: PersonalCatalogService,
    private readonly transactions: PersonalTransactionService,
    private readonly imports: PersonalImportService,
    private readonly classification: PersonalClassificationService,
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly debts: PersonalDebtService,
  ) {}

  // ----- Contas -----

  listAccounts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ListQuery;
    res.json(await this.accounts.listAccounts(vaultId, includeInactive));
  };

  getAccount = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.accounts.getAccount(vaultId, req.params.id!));
  };

  createAccount = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.status(201).json(await this.accounts.createAccount(vaultId, req.body as CreateAccountBody));
  };

  updateAccount = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.accounts.updateAccount(vaultId, req.params.id!, req.body as UpdateAccountBody),
    );
  };

  deleteAccount = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.accounts.deleteAccount(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Cartões -----

  listCards = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ListQuery;
    res.json(await this.accounts.listCards(vaultId, includeInactive));
  };

  getCard = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.accounts.getCard(vaultId, req.params.id!));
  };

  createCard = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.status(201).json(await this.accounts.createCard(vaultId, req.body as CreateCardBody));
  };

  updateCard = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.accounts.updateCard(vaultId, req.params.id!, req.body as UpdateCardBody));
  };

  deleteCard = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.accounts.deleteCard(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Categorias -----

  listCategories = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ListQuery;
    res.json(await this.catalog.listCategoryTree(vaultId, includeInactive));
  };

  createCategory = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res
      .status(201)
      .json(await this.catalog.createCategory(vaultId, req.body as CreateCategoryBody));
  };

  updateCategory = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.catalog.updateCategory(vaultId, req.params.id!, req.body as UpdateCategoryBody),
    );
  };

  deleteCategory = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.catalog.deleteCategory(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Fornecedores -----

  listMerchants = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ListQuery;
    res.json(await this.catalog.listMerchants(vaultId, includeInactive));
  };

  getMerchant = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.catalog.getMerchant(vaultId, req.params.id!));
  };

  createMerchant = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res
      .status(201)
      .json(await this.catalog.createMerchant(vaultId, req.body as CreateMerchantBody));
  };

  updateMerchant = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.catalog.updateMerchant(vaultId, req.params.id!, req.body as UpdateMerchantBody),
    );
  };

  deleteMerchant = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.catalog.deleteMerchant(vaultId, req.params.id!);
    res.status(204).send();
  };

  addAlias = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { alias } = req.body as AddAliasBody;
    res.status(201).json(await this.catalog.addAlias(vaultId, req.params.id!, alias));
  };

  removeAlias = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.catalog.removeAlias(vaultId, req.params.id!, req.params.aliasId!);
    res.status(204).send();
  };

  // ----- Movimentações -----

  listTransactions = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const query = req.validatedQuery as TransactionQuery;
    const { items, total } = await this.transactions.list(vaultId, query);
    res.json({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  };

  getTransaction = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.transactions.get(vaultId, req.params.id!));
  };

  createTransaction = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res
      .status(201)
      .json(await this.transactions.create(vaultId, req.body as CreateTransactionBody));
  };

  updateTransaction = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.transactions.update(vaultId, req.params.id!, req.body as UpdateTransactionBody),
    );
  };

  deleteTransaction = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.transactions.delete(vaultId, req.params.id!);
    res.status(204).send();
  };

  replaceSplits = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { splits } = req.body as ReplaceSplitsBody;
    res.json(await this.transactions.replaceSplits(vaultId, req.params.id!, splits));
  };

  createTransfer = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res
      .status(201)
      .json(await this.transactions.createTransfer(vaultId, req.body as CreateTransferBody));
  };

  // ----- Importação -----

  previewImport = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const body = req.body as PreviewImportBody;
    res.json(
      await this.imports.preview(vaultId, {
        accountId: body.accountId,
        cardId: body.cardId,
        fileName: body.fileName,
        content: body.content,
        profileId: body.profileId,
        settings: body.settings,
      }),
    );
  };

  confirmImport = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.status(201).json(await this.imports.confirm(vaultId, req.body as ConfirmImportBody));
  };

  listImports = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { limit } = req.validatedQuery as ImportHistoryQuery;
    res.json(await this.imports.listBatches(vaultId, limit));
  };

  listImportProfiles = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.imports.listProfiles(vaultId));
  };

  createImportProfile = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const body = req.body as CreateImportProfileBody;
    res.status(201).json(
      await this.imports.createProfile(vaultId, {
        name: body.name,
        accountId: body.accountId,
        cardId: body.cardId,
        format: body.format,
        delimiter: body.delimiter,
        decimalSeparator: body.decimalSeparator,
        dateOrder: body.dateOrder,
        hasHeader: body.hasHeader,
        invertSign: body.invertSign,
        columnMap: body.columnMap,
      }),
    );
  };

  updateImportProfile = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.imports.updateProfile(
        vaultId,
        req.params.id!,
        req.body as UpdateImportProfileBody,
      ),
    );
  };

  deleteImportProfile = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.imports.deleteProfile(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Classificação e regras -----

  listRules = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ListQuery;
    res.json(await this.classification.list(vaultId, includeInactive));
  };

  createRule = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const body = req.body as CreateRuleBody;
    res.status(201).json(
      await this.classification.createRule(vaultId, {
        ...body,
        isActive: true,
        setSubscriptionId: body.setSubscriptionId,
        matchAmountMinCents: toCents(body.matchAmountMin),
        matchAmountMaxCents: toCents(body.matchAmountMax),
      }),
    );
  };

  updateRule = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const body = req.body as UpdateRuleBody;
    const { matchAmountMin, matchAmountMax, ...rest } = body;
    res.json(
      await this.classification.updateRule(vaultId, req.params.id!, {
        ...rest,
        ...(matchAmountMin !== undefined ? { matchAmountMinCents: toCents(matchAmountMin) } : {}),
        ...(matchAmountMax !== undefined ? { matchAmountMaxCents: toCents(matchAmountMax) } : {}),
      }),
    );
  };

  deleteRule = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.classification.deleteRule(vaultId, req.params.id!);
    res.status(204).send();
  };

  runClassification = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { limit } = req.body as ClassificationRunBody;
    res.json(await this.classification.runPending(vaultId, limit));
  };

  correctClassification = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.classification.correct(
        vaultId,
        req.params.id!,
        req.body as CorrectClassificationBody,
      ),
    );
  };

  // ----- Assinaturas -----

  listSubscriptions = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { status } = req.validatedQuery as SubscriptionQuery;
    res.json(await this.subscriptions.list(vaultId, status ?? null));
  };

  getSubscription = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.subscriptions.get(vaultId, req.params.id!));
  };

  createSubscription = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const body = req.body as CreateSubscriptionBody;
    const { expectedAmount, ...rest } = body;
    res
      .status(201)
      .json(
        await this.subscriptions.create(vaultId, requireAuth(req).organizationId, {
          ...rest,
          expectedCents: parseMoney(expectedAmount),
        }),
      );
  };

  updateSubscription = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { expectedAmount, ...rest } = req.body as UpdateSubscriptionBody;
    res.json(
      await this.subscriptions.update(vaultId, requireAuth(req).organizationId, req.params.id!, {
        ...rest,
        ...(expectedAmount !== undefined ? { expectedCents: parseMoney(expectedAmount) } : {}),
      }),
    );
  };

  deleteSubscription = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.subscriptions.delete(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Alertas -----

  /** Roda a verificação e devolve o que está pendente. É o que a abertura do
   *  Cofre chama -- o push é a segunda camada, não a garantia. */
  refreshAlerts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId, ownerUserId } = requireVaultContext(req);
    res.json(await this.subscriptions.refresh(vaultId, todayUtc(), ownerUserId));
  };

  listAlerts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.subscriptions.listAlerts(vaultId, todayUtc()));
  };

  countAlerts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json({ count: await this.subscriptions.countAlerts(vaultId, todayUtc()) });
  };

  markAlertRead = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.subscriptions.markAlertRead(vaultId, req.params.id!));
  };

  snoozeAlert = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { until } = req.body as SnoozeAlertBody;
    res.json(await this.subscriptions.snoozeAlert(vaultId, req.params.id!, until));
  };

  // ----- Faturas -----

  listStatements = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { cardId } = req.validatedQuery as StatementQuery;
    res.json(await this.transactions.listStatements(vaultId, cardId));
  };

  getStatement = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.transactions.getStatement(vaultId, req.params.id!));
  };

  payStatement = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.transactions.payStatement(vaultId, req.params.id!, req.body as PayStatementBody),
    );
  };

  // ----- Resumo do mês -----

  monthSummary = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { month } = req.validatedQuery as { month: string };
    res.json(await this.transactions.summarizeMonth(vaultId, month));
  };

  // ----- Pessoas -----

  listContacts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { includeInactive } = req.validatedQuery as ContactQuery;
    res.json(await this.debts.listContacts(vaultId, includeInactive));
  };

  createContact = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.status(201).json(await this.debts.createContact(vaultId, req.body as CreateContactBody));
  };

  updateContact = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(
      await this.debts.updateContact(vaultId, req.params.id!, req.body as UpdateContactBody),
    );
  };

  deleteContact = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.debts.deleteContact(vaultId, req.params.id!);
    res.status(204).send();
  };

  // ----- Dividas -----

  listDebts = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.debts.list(vaultId, req.validatedQuery as DebtQuery));
  };

  debtSummary = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.debts.summary(vaultId));
  };

  createDebt = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.status(201).json(await this.debts.create(vaultId, req.body as CreateDebtBody));
  };

  getDebt = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.debts.get(vaultId, req.params.id!));
  };

  updateDebt = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.debts.update(vaultId, req.params.id!, req.body as UpdateDebtBody));
  };

  deleteDebt = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    await this.debts.delete(vaultId, req.params.id!);
    res.status(204).send();
  };

  addDebtPayment = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res
      .status(201)
      .json(await this.debts.addPayment(vaultId, req.params.id!, req.body as AddPaymentBody));
  };

  deleteDebtPayment = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.debts.deletePayment(vaultId, req.params.id!, req.params.paymentId!));
  };
}

/** String decimal -> centavos, preservando null. */
function toCents(value: string | null): number | null {
  return value === null ? null : parseMoney(value);
}
