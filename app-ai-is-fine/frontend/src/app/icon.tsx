import { ImageResponse } from "next/og";

/** Favicon generated at build time by the Next.js App Router icon convention. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        🔥
      </div>
    ),
    { ...size }
  );
}
