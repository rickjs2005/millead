import { describe, expect, it } from "vitest";
import { accountTypeFromOfx, emptyIdentity, identityFromOfx, last4Of } from "./import-identity.js";

/**
 * Os dois formatos que os bancos brasileiros exportam, com dados inventados.
 *
 * O SGML (OFX 1.x) é o mais comum por aqui e é o que quebra parser de XML: as
 * tags não fecham. O XML (2.x) fecha tudo. O mesmo leitor precisa atender aos
 * dois, e é isso que estes testes fixam.
 */
const OFX_SGML_CONTA = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<SIGNONMSGSRSV1><SONRS>
<FI><ORG>Banco Exemplo<FID>260</FI>
</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>260
<ACCTID>1234567-8
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801
<DTEND>20260831
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805<TRNAMT>-120.00<FITID>abc1<MEMO>MERCADO</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>2450.75<DTASOF>20260831</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const OFX_XML_CARTAO = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <SIGNONMSGSRSV1><SONRS>
    <FI><ORG>Cartao Exemplo</ORG><FID>999</FID></FI>
  </SONRS></SIGNONMSGSRSV1>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <CURDEF>BRL</CURDEF>
    <CCACCTFROM><ACCTID>5555444433331111</ACCTID></CCACCTFROM>
    <BANKTRANLIST>
      <DTSTART>20260801</DTSTART>
      <DTEND>20260831</DTEND>
    </BANKTRANLIST>
    <LEDGERBAL><BALAMT>-1890.40</BALAMT><DTASOF>20260831</DTASOF></LEDGERBAL>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

describe("identidade de conta (OFX SGML)", () => {
  const id = identityFromOfx(OFX_SGML_CONTA);

  it("reconhece que é conta, não cartão", () => {
    expect(id.kind).toBe("account");
  });

  it("lê a instituição declarada pelo próprio arquivo", () => {
    expect(id.institution).toBe("Banco Exemplo");
    expect(id.bankId).toBe("260");
    expect(id.fid).toBe("260");
  });

  it("extrai os 4 últimos dígitos ignorando a formatação da conta", () => {
    expect(id.accountNumber).toBe("1234567-8");
    expect(id.last4).toBe("5678");
  });

  it("lê tipo, moeda e período", () => {
    expect(id.accountType).toBe("CHECKING");
    expect(id.currency).toBe("BRL");
    expect(id.periodStart).toBe("20260801");
    expect(id.periodEnd).toBe("20260831");
  });

  it("lê o saldo do extrato e a data dele", () => {
    expect(id.balance).toBe("2450.75");
    expect(id.balanceAt).toBe("20260831");
  });
});

describe("identidade de cartão (OFX XML)", () => {
  const id = identityFromOfx(OFX_XML_CARTAO);

  it("CCACCTFROM é a declaração de que é fatura de cartão", () => {
    // Sem isso, uma fatura entraria como conta corrente e o pagamento dela
    // viraria uma segunda despesa.
    expect(id.kind).toBe("card");
  });

  it("lê os mesmos campos que no SGML", () => {
    expect(id.institution).toBe("Cartao Exemplo");
    expect(id.last4).toBe("1111");
    expect(id.currency).toBe("BRL");
    expect(id.periodStart).toBe("20260801");
    expect(id.balance).toBe("-1890.40");
  });

  it("cartão não declara ACCTTYPE, e isso vira null em vez de palpite", () => {
    expect(id.accountType).toBeNull();
  });
});

describe("nome do banco quando o arquivo não diz", () => {
  it("cai na tabela de código COMPE", () => {
    const semOrg = OFX_SGML_CONTA.replace("<ORG>Banco Exemplo", "<ORG>");
    expect(identityFromOfx(semOrg).institution).toBe("Nubank"); // 260
  });

  it("mas o ORG do arquivo sempre ganha da tabela", () => {
    // É o próprio banco se nomeando; a tabela é só atalho de exibição.
    expect(identityFromOfx(OFX_SGML_CONTA).institution).toBe("Banco Exemplo");
  });

  it("código desconhecido não vira nome inventado", () => {
    const outro = OFX_SGML_CONTA.replace("<ORG>Banco Exemplo", "<ORG>").replace(
      "<BANKID>260",
      "<BANKID>777",
    );
    expect(identityFromOfx(outro).institution).toBeNull();
  });
});

describe("arquivo incompleto", () => {
  it("campo ausente vira null, e a tela pergunta", () => {
    const id = identityFromOfx("<OFX><STMTTRN></STMTTRN></OFX>");
    expect(id.kind).toBeNull();
    expect(id.institution).toBeNull();
    expect(id.last4).toBeNull();
    expect(id.currency).toBeNull();
  });
});

describe("últimos 4 dígitos", () => {
  it("ignora tudo que não é dígito", () => {
    expect(last4Of("1234567-8")).toBe("5678");
    expect(last4Of("0001 1234567")).toBe("4567");
    expect(last4Of("**** **** **** 1111")).toBe("1111");
  });

  it("com menos de quatro dígitos devolve null", () => {
    // "··12" na tela seria pior que não mostrar nada.
    expect(last4Of("123")).toBeNull();
    expect(last4Of("ab")).toBeNull();
    expect(last4Of(null)).toBeNull();
  });
});

describe("tipo de conta", () => {
  it("mapeia os que o Cofre tem", () => {
    expect(accountTypeFromOfx("CHECKING")).toBe("CHECKING");
    expect(accountTypeFromOfx("savings")).toBe("SAVINGS");
  });

  it("tipo sem equivalente vira null em vez de cair em conta corrente", () => {
    expect(accountTypeFromOfx("MONEYMRKT")).toBeNull();
    expect(accountTypeFromOfx("CREDITLINE")).toBeNull();
    expect(accountTypeFromOfx(null)).toBeNull();
  });
});

describe("identidade vazia", () => {
  it("é o que o CSV devolve — ele não se descreve", () => {
    const id = emptyIdentity();
    expect(Object.values(id).every((v) => v === null)).toBe(true);
  });
});
