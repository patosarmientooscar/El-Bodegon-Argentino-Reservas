import { ImageResponse } from "next/og";

import { getPublicRestaurant } from "@/lib/public-booking/data";

export const alt = "Reserva tu mesa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#c8a24a";
const CREAM = "#f3ead8";
const WOOD = "#5b3a22";
const CHAIR = "#3a2415";

function Chair({ top, left, rotate }: { top: number; left: number; rotate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 78,
        height: 64,
        borderRadius: 16,
        background: CHAIR,
        borderBottom: `14px solid #24160c`,
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}

function Plate({ top, left }: { top: number; left: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 46,
        height: 46,
        borderRadius: 999,
        background: CREAM,
        border: `5px solid #d9ccb1`,
      }}
    />
  );
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  const result = await getPublicRestaurant(slug);
  const name = result.status === "ok" ? result.restaurant.name : "Reserva tu mesa";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "radial-gradient(circle at 78% 50%, #2a2014 0%, #0f0d0b 58%)",
          padding: "0 80px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: GOLD, textTransform: "uppercase" }}>
            Reserva tu mesa
          </div>
          <div style={{ fontSize: 84, lineHeight: 1.05, color: CREAM, marginTop: 22, fontWeight: 700 }}>{name}</div>
          <div style={{ width: 120, height: 3, background: GOLD, marginTop: 34 }} />
          <div style={{ fontSize: 30, color: "rgba(243,234,216,0.7)", marginTop: 30 }}>
            En menos de 20 segundos · sin registro
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", width: 380, height: 380, marginLeft: 20 }}>
          <Chair top={10} left={151} rotate={180} />
          <Chair top={306} left={151} rotate={0} />
          <Chair top={158} left={4} rotate={90} />
          <Chair top={158} left={298} rotate={-90} />
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 80,
              width: 220,
              height: 220,
              borderRadius: 30,
              background: `linear-gradient(135deg, #7a5232 0%, ${WOOD} 55%, #3e2716 100%)`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          />
          <Plate top={96} left={167} />
          <Plate top={238} left={167} />
          <Plate top={167} left={96} />
          <Plate top={167} left={238} />
          <div
            style={{
              position: "absolute",
              top: 176,
              left: 176,
              width: 28,
              height: 28,
              borderRadius: 999,
              background: GOLD,
              boxShadow: `0 0 50px 22px rgba(200,162,74,0.55)`,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
