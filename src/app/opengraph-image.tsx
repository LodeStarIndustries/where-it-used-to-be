// The preview card shown when someone shares the game's link. Placeholder
// artwork until Mike supplies the final share image.
import { ImageResponse } from "next/og";

export const alt = "Where It Used To Be: a daily map game about Saint John businesses that are gone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#12324A",
          padding: 80,
          color: "#FFFFFF",
        }}
      >
        <svg width="200" height="200" viewBox="0 0 100 100">
          <path d="M50 8c-17.7 0-32 14-32 31.5C18 63 50 92 50 92s32-29 32-52.5C82 22 67.7 8 50 8z" fill="#B5452F" />
          <circle cx="50" cy="39" r="12.5" fill="#EEF2F4" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, flex: 1 }}>
          <span style={{ fontSize: 76, lineHeight: 1.05 }}>Where It Used To Be</span>
          <span style={{ fontSize: 36, marginTop: 28, color: "#C9D6DF" }}>
            A free daily map game about the Saint John businesses that are gone.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
