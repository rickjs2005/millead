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
import type { PersonalAccountService } from "../../../application/services/personal-account-service.js";
import type { PersonalCatalogService } from "../../../application/services/personal-catalog-service.js";
import type { PersonalTransactionService } from "../../../application/services/personal-transaction-service.js";
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
}
