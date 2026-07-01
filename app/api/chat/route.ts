import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

console.log("API KEY:", process.env.GEMINI_API_KEY);
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      image,
      history = [],
    } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // ==========================
    // Riwayat Percakapan
    // ==========================

    const conversation = history
      .map((msg: any) => {
        if (typeof msg.content === "string") {
          return `${
            msg.role === "user"
              ? "User"
              : "Assistant"
          }: ${msg.content}`;
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

    // ==========================
    // Prompt AI
    // ==========================

    const prompt = `
Kamu adalah HealthRoute AI.

Tugasmu:

- Ingat seluruh riwayat percakapan.
- Jawab berdasarkan konteks sebelumnya.
- Jika pengguna menambahkan gejala baru, gabungkan dengan gejala sebelumnya.
- Analisis gambar jika tersedia.
- Jangan pernah memberikan diagnosis pasti.
- Gunakan Bahasa Indonesia.
- Balas HANYA dalam format JSON.

Isi "hospitalKeyword" dengan kata pencarian Google Maps.

Contoh:
- Rumah Sakit
- Puskesmas
- Klinik Umum
- Dokter Anak
- Dokter Kulit
- Dokter THT
- Dokter Gigi

Format:

{
  "urgency":"Low | Medium | High",
  "recommendedService":"",
  "possibleCondition":"",
  "advice":"",
  "hospitalKeyword":"",
  "emergency":false
}

Riwayat Percakapan:

${conversation}

Pesan Terbaru:

${message || "Tidak ada teks"}
`;

    let result;

    if (image) {
      const base64 = image.split(",")[1];

      result = await model.generateContent([
        {
          text: prompt,
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64,
          },
        },
      ]);
    } else {
      result = await model.generateContent(prompt);
    }

    const text = result.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("========== RAW GEMINI ==========");
    console.log(text);
    console.log("================================");

    let json;

    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      console.error("Response Gemini:", text);

      return NextResponse.json(
        {
          success: false,
          reply: {
            urgency: "Low",
            recommendedService: "-",
            possibleCondition: "-",
            advice:
              "Output Gemini bukan JSON yang valid.",
            hospitalKeyword: "Rumah Sakit",
            emergency: false,
          },
        },
        {
          status: 500,
        }
      );
    }

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
          advice:
            "Terjadi kesalahan saat memproses permintaan.",
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