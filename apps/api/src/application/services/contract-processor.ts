import type {
  ContractedSnapshot,
  ContractorSnapshot,
} from "../../domain/entities/contract.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { ContractNotifier } from "../../domain/services/contract-notifier.js";
import type { ContractSignatureGateway } from "../../domain/services/contract-signature.js";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Dados que o renderizador de PDF espera (espelho do ContratoPDFData). */
export interface ContractPdfData {
  numero: string;
  tipo: "SITE" | "SISTEMA" | "SAAS" | "MANUTENCAO" | "CONSULTORIA";
  criadoEm: string;
  contratante: ContractorSnapshot;
  contratada: ContractedSnapshot;
  projeto: {
    descricao: string;
    valorTotal: string;
    entrada: string;
    restante: string;
    percentualEntrada: number;
    formaPagamento: string;
    prazoEntregaDias: number;
    limiteRevisoes: number;
  };
}

export type ContractPdfRenderer = (data: ContractPdfData) => Promise<Buffer>;

/**
 * Processa um contrato de ponta a ponta: PDF -> documento de assinatura ->
 * convite. Rodado SOMENTE pelo worker BullMQ. Idempotente: já enviado ou
 * assinado, não reprocessa; retry reaproveita o docId existente.
 */
export class ContractProcessor {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly renderPdf: ContractPdfRenderer,
    private readonly gateway: ContractSignatureGateway,
    private readonly notifier: ContractNotifier,
    private readonly webhookUrl: string,
  ) {}

  async run(contractId: string, organizationId: string): Promise<void> {
    const contract = await this.contracts.findByIdForOrg(contractId, organizationId);
    if (!contract) throw new Error(`contrato ${contractId} não encontrado`);

    if (contract.status === "AGUARDANDO_ASSINATURA" || contract.status === "ASSINADO") {
      return; // idempotência
    }

    const contratante = contract.contractorSnapshot as ContractorSnapshot;
    const contratada = contract.contractedSnapshot as ContractedSnapshot;

    try {
      const valorTotal = Number(contract.valorTotal);
      const pct = Number(contract.percentualEntrada);
      const entrada = +(valorTotal * (pct / 100)).toFixed(2);
      const restante = +(valorTotal - entrada).toFixed(2);

      // 1) PDF
      const pdf = await this.renderPdf({
        numero: contract.numero,
        tipo: contract.tipo,
        criadoEm: DATA.format(contract.createdAt),
        contratante,
        contratada,
        projeto: {
          descricao: contract.descricaoProjeto,
          valorTotal: BRL.format(valorTotal),
          entrada: BRL.format(entrada),
          restante: BRL.format(restante),
          percentualEntrada: pct,
          formaPagamento: contract.formaPagamento,
          prazoEntregaDias: contract.prazoEntregaDias,
          limiteRevisoes: contract.limiteRevisoes,
        },
      });
      await this.contracts.savePdfOriginal(contract.id, pdf);
      await this.contracts.addEvent(contract.id, organizationId, "PDF_GERADO", "WORKER");

      // 2) Documento de assinatura (reusa docId em retry)
      let docId = contract.signatureDocId;
      let signUrl = contract.signatureUrl;
      if (!docId) {
        const doc = await this.gateway.criarDocumento({
          nome: `Contrato ${contract.numero}`,
          pdfBase64: pdf.toString("base64"),
          signatarios: contract.signers.map((s) => ({
            nome: s.nome,
            email: s.email,
            telefone: contratante.telefone,
            papel: s.papel,
          })),
          webhookUrl: this.webhookUrl,
          metadata: { contractId: contract.id },
        });
        docId = doc.docId;
        signUrl = doc.signUrl;
      }
      await this.contracts.setSignatureDoc(contract.id, docId, signUrl ?? "");
      await this.contracts.addEvent(contract.id, organizationId, "ENVIADO", "WORKER", { docId });

      // 3) Convite por e-mail (redundância além do provedor; best-effort)
      if (signUrl) {
        await this.notifier.conviteAssinatura({
          numero: contract.numero,
          nomeCliente: contratante.nome,
          emailCliente: contratante.email,
          signUrl,
        });
        await this.contracts.addEvent(contract.id, organizationId, "CONVITE_ENVIADO", "WORKER", {
          canal: "email",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida.";
      await this.contracts.addEvent(contract.id, organizationId, "FALHA_PROCESSAMENTO", "WORKER", {
        erro: message,
      });
      throw err;
    }
  }
}
