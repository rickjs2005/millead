import { ImageResponse } from "next/og";

/**
 * Card de compartilhamento (og:image) gerado em build/runtime pelo next/og --
 * evita manter um PNG de 1200x630 versionado e desatualizado no repo. Vale
 * pra todas as rotas que não sobrescrevem, inclusive as públicas que o cliente
 * abre no celular (/p/:token e /b/:token).
 *
 * O renderer (Satori) não é um browser: só um subset de CSS, sem Tailwind e
 * sem `display: block` implícito -- todo container com mais de um filho
 * precisa de `display: flex` explícito.
 */
export const alt = "MilLead — CRM da MilWeb";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#12a3e0";
const CANVAS = "#0b0f1a";

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: CANVAS,
        backgroundImage: `radial-gradient(ellipse 70% 60% at 15% 0%, ${BRAND}44, transparent)`,
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "72px",
            height: "72px",
            borderRadius: "18px",
            background: BRAND,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={CANVAS}
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <span style={{ fontSize: "44px", fontWeight: 600, letterSpacing: "-0.02em" }}>MilLead</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "68px",
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          <span>A operação comercial inteira,</span>
          <span>num lugar só.</span>
        </div>
        <div style={{ fontSize: "30px", color: "#a1a1aa" }}>
          Pipeline · Propostas · Contratos · Briefings
        </div>
      </div>

      <div style={{ display: "flex", fontSize: "24px", color: "#71717a" }}>CRM da MilWeb</div>
    </div>,
    size,
  );
}
