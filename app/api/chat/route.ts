import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

console.log("GEMINI =", process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      image,
      history = [],
    } = await req.json();

    const conversation = history
      .map((msg: any) => {
        if (typeof msg.content === "string") {
          return `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
        }

        return `
Assistant:
Urgensi: ${msg.content.urgency}
Layanan: ${msg.content.recommendedService}
Kondisi: ${msg.content.possibleCondition}
Saran: ${msg.content.advice}
`;
      })
      .join("\n");

    const prompt = `
Kamu adalah HealthRoute AI.

Tugasmu:
- Ingat seluruh riwayat percakapan.
- Gabungkan gejala lama dan baru.
- Analisis gambar jika tersedia.
- Jangan memberikan diagnosis pasti.
- Gunakan Bahasa Indonesia.
- Balas HANYA JSON.

Format:

{
  "urgency":"Low | Medium | High",
  "recommendedService":"",
  "possibleCondition":"",
  "advice":"",
  "hospitalKeyword":"",
  "emergency":false
}

Riwayat:

${conversation}

Pesan terbaru:

${message || "Tidak ada teks"}
`;

    let response;

    if (image) {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: image.split(",")[1],
                },
              },
            ],
          },
        ],
      });
    } else {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    }

    const text = response.text ?? "";

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const json = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      reply: json,
    });
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json(
      {
        success: false,
        reply: {
          urgency: "Low",
          recommendedService: "-",
          possibleCondition: "-",
          advice: "Terjadi kesalahan saat memproses permintaan.",
          hospitalKeyword: "Rumah Sakit",
          emergency: false,
        },
      },
      {
        status: 500,
      }
    );
  }
}