import { describe, expect, it } from "vitest";
import { parseOfx } from "./import-ofx.js";

/** OFX 1.x: SGML, cabeçalho `CHAVE:VALOR` e tags que não fecham. */
const OFX_1 = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>001<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801
<DTEND>20260831
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260805120000[-3:BRT]
<TRNAMT>-120.00
<FITID>202608050001
<MEMO>ANTHROPIC CLAUDE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260810
<TRNAMT>2500.00
<FITID>202608100002
<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

/** OFX 2.x: XML de verdade, tudo fechado. */
const OFX_2 = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211"?>
<OFX>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <CURDEF>BRL</CURDEF>
    <CCACCTFROM><ACCTID>4444</ACCTID></CCACCTFROM>
    <BANKTRANLIST>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20260812</DTPOSTED>
        <TRNAMT>-45.90</TRNAMT>
        <FITID>ABC-1</FITID>
        <MEMO>IFOOD *IFD BRASIL</MEMO>
      </STMTTRN>
    </BANKTRANLIST>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

describe("parseOfx — OFX 1.x (SGML, tags sem fechamento)", () => {
  it("lê as transações do extrato", () => {
    const doc = parseOfx(OFX_1)!;
    expect(doc.transactions).toHaveLength(2);

    expect(doc.transactions[0]).toEqual({
      fitid: "202608050001",
      datePosted: "20260805120000[-3:BRT]",
      amount: "-120.00",
      description: "ANTHROPIC CLAUDE",
      type: "DEBIT",
    });
  });

  it("usa NAME quando não há MEMO", () => {
    const doc = parseOfx(OFX_1)!;
    expect(doc.transactions[1]!.description).toBe("SALARIO");
  });

  it("lê moeda e o período declarado no arquivo", () => {
    const doc = parseOfx(OFX_1)!;
    expect(doc.currency).toBe("BRL");
    expect(doc.periodStart).toBe("20260801");
    expect(doc.periodEnd).toBe("20260831");
  });

  it("lê a identificação da conta (só pra conferir com a origem escolhida)", () => {
    expect(parseOfx(OFX_1)!.accountId).toBe("12345-6");
  });
});

describe("parseOfx — OFX 2.x (XML)", () => {
  it("lê o mesmo formato de saída, com as tags fechadas", () => {
    const doc = parseOfx(OFX_2)!;
    expect(doc.transactions).toHaveLength(1);
    expect(doc.transactions[0]).toMatchObject({
      fitid: "ABC-1",
      amount: "-45.90",
      description: "IFOOD *IFD BRASIL",
    });
    expect(doc.accountId).toBe("4444");
  });
});

describe("parseOfx — arquivo inválido", () => {
  it("devolve null pro que não é OFX", () => {
    expect(parseOfx("")).toBeNull();
    expect(parseOfx("Data,Descricao,Valor\n1,2,3")).toBeNull();
    expect(parseOfx("<html><body>erro de login</body></html>")).toBeNull();
  });

  it("OFX sem transação nenhuma é OFX válido e vazio, não erro", () => {
    // Extrato de mês sem movimentação existe. Tratar como arquivo inválido
    // faria a pessoa procurar um problema que não existe.
    const vazio = "OFXHEADER:100\n<OFX><BANKTRANLIST></BANKTRANLIST></OFX>";
    const doc = parseOfx(vazio);
    expect(doc).not.toBeNull();
    expect(doc!.transactions).toEqual([]);
  });

  it("ignora transação sem valor em vez de derrubar o arquivo inteiro", () => {
    const parcial = `OFXHEADER:100
<OFX><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260805<FITID>1<MEMO>SEM VALOR</STMTTRN>
<STMTTRN><DTPOSTED>20260806<TRNAMT>-10.00<FITID>2<MEMO>OK</STMTTRN>
</BANKTRANLIST></OFX>`;
    const doc = parseOfx(parcial)!;
    // A linha ruim vem com amount null e é rejeitada depois, com o número da
    // linha -- perder o arquivo inteiro por uma linha seria desproporcional.
    expect(doc.transactions).toHaveLength(2);
    expect(doc.transactions[0]!.amount).toBeNull();
    expect(doc.transactions[1]!.amount).toBe("-10.00");
  });
});
