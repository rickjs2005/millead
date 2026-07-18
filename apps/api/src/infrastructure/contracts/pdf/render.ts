import { PDFDocument } from "pdf-lib";
import {
  COLORS,
  CONTENT_W,
  MARGIN,
  PAGE_H,
  PAGE_W,
  TOP_START,
  addPage,
  drawClause,
  drawFooters,
  drawHeader,
  drawParagraph,
  embedFonts,
  ensureSpace,
  sanitize,
  wrapText,
  type Doc,
  type Fonts,
} from "../../pdf/layout.js";

export { fmtBRL, fmtData } from "./format.js";

export interface ContratoPDFData {
  numero: string;
  tipo: "SITE" | "SISTEMA" | "SAAS" | "MANUTENCAO" | "CONSULTORIA";
  criadoEm: string; // formatado
  contratante: {
    nome: string;
    documento: string;
    tipoPessoa: "PF" | "PJ";
    email: string;
    telefone: string;
    endereco: string;
    nomeEmpresa?: string | null;
  };
  contratada: {
    razaoSocial: string;
    cnpj: string;
    docLabel?: string; // "CNPJ" (PJ) ou "CPF" (PF) — default "CNPJ"
    endereco: string;
    email: string;
    foro: string;
  };
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

const objetoPorTipo: Record<ContratoPDFData["tipo"], string> = {
  SITE: "desenvolvimento de website institucional/landing page",
  SISTEMA: "desenvolvimento de sistema web sob medida",
  SAAS: "desenvolvimento e disponibilização de plataforma SaaS",
  MANUTENCAO: "prestação de serviços de manutenção e suporte técnico",
  CONSULTORIA: "prestação de serviços de consultoria em tecnologia",
};

// Bloco de parte (CONTRATADA/CONTRATANTE) com barra azul-marca e fundo claro.
function drawParty(doc: Doc, label: string, body: string): void {
  const padX = 11;
  const padY = 8;
  const innerW = CONTENT_W - padX - 6;
  const lines = wrapText(body, doc.fonts.regular, 9.5, innerW);
  const labelLineH = 13;
  const bodyLineH = 13;
  const blockH = padY * 2 + labelLineH + lines.length * bodyLineH;

  ensureSpace(doc, blockH + 8);

  const topY = doc.y;
  const boxBottom = topY - blockH;

  doc.page.drawRectangle({ x: MARGIN, y: boxBottom, width: CONTENT_W, height: blockH, color: COLORS.brandWeak });
  doc.page.drawRectangle({ x: MARGIN, y: boxBottom, width: 3, height: blockH, color: COLORS.brand });

  let cy = topY - padY;
  doc.page.drawText(sanitize(label).toUpperCase(), {
    x: MARGIN + padX,
    y: cy - 7.5,
    size: 7.5,
    font: doc.fonts.bold,
    color: COLORS.brand,
  });
  cy -= labelLineH;
  for (const line of lines) {
    doc.page.drawText(line, { x: MARGIN + padX, y: cy - 9.5, size: 9.5, font: doc.fonts.regular, color: COLORS.body });
    cy -= bodyLineH;
  }

  doc.y = boxBottom - 8;
}

// Card de resumo financeiro.
function drawFinancialCard(doc: Doc, projeto: ContratoPDFData["projeto"]): void {
  const pad = 12;
  const cardH = 92;
  ensureSpace(doc, cardH + 8);

  const topY = doc.y;
  const boxBottom = topY - cardH;

  doc.page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: CONTENT_W,
    height: cardH,
    color: COLORS.brandWeak,
    borderColor: COLORS.brandBorder,
    borderWidth: 1,
  });

  let cy = topY - pad;
  doc.page.drawText("RESUMO FINANCEIRO", { x: MARGIN + pad, y: cy - 7, size: 7, font: doc.fonts.bold, color: COLORS.brand });
  cy -= 13;
  doc.page.drawText(sanitize(projeto.valorTotal), { x: MARGIN + pad, y: cy - 17, size: 17, font: doc.fonts.bold, color: COLORS.ink });
  cy -= 30;

  const cells: Array<{ label: string; value: string }> = [
    { label: `ENTRADA (${projeto.percentualEntrada}%)`, value: projeto.entrada },
    { label: "RESTANTE", value: projeto.restante },
    { label: "PAGAMENTO", value: projeto.formaPagamento },
    { label: "PRAZO", value: `${projeto.prazoEntregaDias} dias` },
  ];
  const cellW = (CONTENT_W - pad * 2) / 4;
  cells.forEach((cell, i) => {
    const cellX = MARGIN + pad + i * cellW;
    doc.page.drawText(sanitize(cell.label), { x: cellX, y: cy - 6.5, size: 6.5, font: doc.fonts.regular, color: COLORS.muted });
    doc.page.drawText(sanitize(cell.value), { x: cellX, y: cy - 18, size: 9, font: doc.fonts.bold, color: COLORS.ink });
  });

  doc.y = boxBottom - 12;
}

// Bloco de assinaturas (mantém junto se couber).
function drawSignatures(
  doc: Doc,
  contratante: ContratoPDFData["contratante"],
  contratada: ContratoPDFData["contratada"],
): void {
  const blockH = 60;
  if (doc.y - 34 - blockH < 70) {
    addPage(doc);
  } else {
    doc.y -= 34;
  }

  const colW = CONTENT_W * 0.44;
  const gap = CONTENT_W - colW * 2;
  const cols = [
    { x: MARGIN, name: contratante.nome, role: "CONTRATANTE" },
    { x: MARGIN + colW + gap, name: contratada.razaoSocial, role: "CONTRATADA" },
  ];

  const lineY = doc.y;
  for (const col of cols) {
    const centerX = col.x + colW / 2;
    doc.page.drawLine({ start: { x: col.x, y: lineY }, end: { x: col.x + colW, y: lineY }, thickness: 1, color: COLORS.muted });
    const name = sanitize(col.name);
    const nameW = doc.fonts.bold.widthOfTextAtSize(name, 9.5);
    doc.page.drawText(name, { x: centerX - nameW / 2, y: lineY - 13, size: 9.5, font: doc.fonts.bold, color: COLORS.ink });
    const roleW = doc.fonts.regular.widthOfTextAtSize(col.role, 7.5);
    doc.page.drawText(col.role, { x: centerX - roleW / 2, y: lineY - 24, size: 7.5, font: doc.fonts.regular, color: COLORS.muted });
    const ae = "Assinatura eletronica";
    const aeW = doc.fonts.regular.widthOfTextAtSize(ae, 7);
    doc.page.drawText(ae, { x: centerX - aeW / 2, y: lineY - 35, size: 7, font: doc.fonts.regular, color: COLORS.brand });
  }

  doc.y = lineY - blockH;
}

/** Renderiza o contrato em PDF com pdf-lib e retorna um Buffer (Node). */
export async function renderContratoPDF(data: ContratoPDFData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Contrato ${data.numero}`);
  pdf.setAuthor(data.contratada.razaoSocial);

  const fonts: Fonts = await embedFonts(pdf);

  const firstPage = pdf.addPage([PAGE_W, PAGE_H]);
  const doc: Doc = {
    pdf,
    fonts,
    page: firstPage,
    y: TOP_START,
    header: {
      brandTitle: "MilWeb",
      brandSubtitle: "C O N T R A T O S",
      chipLabel: "CONTRATO Nº",
      chipValue: data.numero,
      chipSub: `Emitido em ${data.criadoEm}`,
    },
  };
  doc.y = drawHeader(doc);

  const { contratante, contratada, projeto } = data;

  // Título (somente página 1).
  doc.page.drawText(sanitize("CONTRATO DE PRESTAÇÃO DE SERVIÇOS"), {
    x: MARGIN,
    y: doc.y - 13,
    size: 13,
    font: fonts.bold,
    color: COLORS.ink,
  });
  doc.y -= 13 + 6;
  // Régua azul-marca.
  doc.page.drawRectangle({ x: MARGIN, y: doc.y - 3, width: 42, height: 3, color: COLORS.brand });
  doc.y -= 3 + 16;

  // Partes.
  drawParty(
    doc,
    "Contratada",
    `${contratada.razaoSocial}, inscrito(a) no ${contratada.docLabel ?? "CNPJ"} sob nº ${contratada.cnpj}, com sede em ${contratada.endereco}, doravante denominada CONTRATADA.`,
  );
  const nomeEmpresa = contratante.nomeEmpresa ? ` (${contratante.nomeEmpresa})` : "";
  const docLabel = contratante.tipoPessoa === "PF" ? "CPF" : "CNPJ";
  drawParty(
    doc,
    "Contratante",
    `${contratante.nome}${nomeEmpresa}, portador(a) do ${docLabel} nº ${contratante.documento}, e-mail ${contratante.email}, telefone ${contratante.telefone}, residente/estabelecido em ${contratante.endereco}, doravante denominado(a) CONTRATANTE.`,
  );

  // Resumo financeiro.
  drawFinancialCard(doc, projeto);

  // Seção Cláusulas.
  ensureSpace(doc, 24);
  doc.y -= 4;
  drawParagraph(doc, "Cláusulas", { size: 10.5, font: fonts.bold, color: COLORS.ink, lineHeight: 18 });

  // 15 cláusulas — cobre objeto, pagamento/mora, prazo, revisões, suporte,
  // cancelamento/rescisão, propriedade intelectual, domínio, confidencialidade,
  // LGPD, limitação de responsabilidade, natureza da relação, força maior e foro.
  drawClause(
    doc,
    "CLÁUSULA 1ª — DO OBJETO",
    `O presente contrato tem por objeto o ${objetoPorTipo[data.tipo]}, conforme especificação:\n${projeto.descricao}`,
  );
  drawClause(
    doc,
    "CLÁUSULA 2ª — DO VALOR E DA FORMA DE PAGAMENTO",
    `O valor total dos serviços é de ${projeto.valorTotal}, sendo ${projeto.percentualEntrada}% (${projeto.entrada}) a título de entrada, e o restante de ${projeto.restante} conforme a forma de pagamento ${projeto.formaPagamento}. A execução inicia-se após a confirmação da entrada.`,
  );
  drawClause(
    doc,
    "CLÁUSULA 3ª — DA MORA E DO INADIMPLEMENTO",
    "O atraso no pagamento de qualquer parcela sujeitará o CONTRATANTE à multa de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de mora de 1% (um por cento) ao mês e correção monetária, sem prejuízo da suspensão da prestação dos serviços até a regularização, caso o atraso ultrapasse 10 (dez) dias corridos.",
  );
  drawClause(
    doc,
    "CLÁUSULA 4ª — DO PRAZO DE ENTREGA",
    `O prazo estimado de entrega é de ${projeto.prazoEntregaDias} dias corridos, contados do pagamento da entrada e do fornecimento, pelo CONTRATANTE, de todo o conteúdo e dos acessos necessários. Atrasos no fornecimento de conteúdo ou acessos pela CONTRATANTE suspendem a contagem do prazo enquanto perdurarem.`,
  );
  drawClause(
    doc,
    "CLÁUSULA 5ª — DAS REVISÕES",
    `Estão incluídas até ${projeto.limiteRevisoes} rodadas de revisão sem custo adicional. Revisões excedentes ou mudanças de escopo serão orçadas à parte.`,
  );
  drawClause(
    doc,
    "CLÁUSULA 6ª — DO SUPORTE",
    "A CONTRATADA prestará suporte gratuito por 30 (trinta) dias após a entrega para correção de defeitos. Suporte continuado poderá ser objeto de contrato de manutenção específico.",
  );
  drawClause(
    doc,
    "CLÁUSULA 7ª — DO CANCELAMENTO E DA RESCISÃO",
    "Em caso de cancelamento pelo CONTRATANTE, o valor de entrada não será restituído, por cobrir o início dos trabalhos, e os valores referentes a etapas já executadas serão devidos proporcionalmente. Persistindo o inadimplemento do CONTRATANTE por mais de 30 (trinta) dias após o vencimento, a CONTRATADA poderá rescindir o contrato de pleno direito, mediante notificação, sem prejuízo da cobrança dos valores devidos e da retenção dos entregáveis até a quitação integral.",
  );
  drawClause(
    doc,
    "CLÁUSULA 8ª — DOS DIREITOS AUTORAIS E PROPRIEDADE INTELECTUAL",
    "Após a quitação integral, a CONTRATADA cede à CONTRATANTE os direitos sobre os elementos desenvolvidos especificamente para este projeto — conteúdo, identidade visual, textos e customizações exclusivas. A base de código, os componentes, a arquitetura e as ferramentas próprias da CONTRATADA, de natureza reutilizável, permanecem de sua propriedade exclusiva, sendo concedida à CONTRATANTE licença de uso permanente, não exclusiva e intransferível sobre a instância entregue, vedada a revenda ou redistribuição do código-fonte. Códigos, bibliotecas e ferramentas de terceiros permanecem sob suas respectivas licenças. A CONTRATADA poderá exibir o trabalho em seu portfólio.",
  );
  drawClause(
    doc,
    "CLÁUSULA 9ª — DO DOMÍNIO E DA HOSPEDAGEM",
    "O registro do domínio e os serviços de hospedagem serão mantidos em nome da CONTRATANTE, que assume os respectivos custos e renovações a partir da data de entrega. A CONTRATADA realizará a transferência de titularidade e a configuração de DNS necessária ao funcionamento do site, não se responsabilizando por interrupções decorrentes de não renovação pela CONTRATANTE.",
  );
  drawClause(
    doc,
    "CLÁUSULA 10ª — DA CONFIDENCIALIDADE",
    "As partes comprometem-se a manter sigilo sobre as informações confidenciais trocadas em razão deste contrato — dados técnicos, comerciais, de acesso e credenciais —, não as divulgando a terceiros nem as utilizando fora da finalidade aqui prevista, obrigação que subsiste por 2 (dois) anos após o encerramento deste contrato.",
  );
  drawClause(
    doc,
    "CLÁUSULA 11ª — DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)",
    "Os dados pessoais do CONTRATANTE coletados para a execução deste contrato serão tratados pela CONTRATADA exclusivamente para essa finalidade, em conformidade com a Lei nº 13.709/2018 (LGPD), não sendo compartilhados com terceiros salvo quando necessário à prestação dos serviços (ex.: provedores de assinatura eletrônica, hospedagem e pagamento) ou por determinação legal.",
  );
  drawClause(
    doc,
    "CLÁUSULA 12ª — DA LIMITAÇÃO DE RESPONSABILIDADE",
    "A responsabilidade da CONTRATADA restringe-se à correta execução dos serviços descritos na Cláusula 1ª, não respondendo por danos indiretos, lucros cessantes, ou perda de dados decorrentes de causas alheias à sua atuação, nem por conteúdo, integrações e serviços de terceiros fornecidos ou contratados pelo CONTRATANTE. Em qualquer hipótese, a responsabilidade total da CONTRATADA fica limitada ao valor efetivamente pago pelo CONTRATANTE neste contrato.",
  );
  drawClause(
    doc,
    "CLÁUSULA 13ª — DA NATUREZA DA RELAÇÃO ENTRE AS PARTES",
    "Este contrato tem natureza estritamente civil, não gerando vínculo empregatício, societário ou de subordinação entre as partes, atuando a CONTRATADA com plena autonomia técnica e organizacional na execução dos serviços.",
  );
  drawClause(
    doc,
    "CLÁUSULA 14ª — DO CASO FORTUITO E DA FORÇA MAIOR",
    "Nenhuma das partes será responsabilizada por atraso ou inexecução decorrente de caso fortuito ou força maior — incluindo falhas de provedores externos, instabilidade de internet, decisões governamentais ou outros eventos alheios à sua vontade —, devendo a parte afetada comunicar a outra e envidar esforços razoáveis para mitigar os efeitos.",
  );
  drawClause(
    doc,
    "CLÁUSULA 15ª — DO FORO",
    `Fica eleito o foro da ${contratada.foro} para dirimir quaisquer questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
  );

  // Assinaturas.
  drawSignatures(doc, contratante, contratada);

  // Segundo passe: rodapés com numeração final.
  drawFooters(pdf, fonts, {
    footerLeft: contratada.razaoSocial,
    footerCenter: `Documento assinado eletronicamente - trilha de auditoria - ${data.numero}`,
  });

  return Buffer.from(await pdf.save());
}
