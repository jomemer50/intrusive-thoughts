import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const hf_token = process.env.HF_TOKEN;
    const client = await Client.connect("tonyassi/voice-clone", (hf_token ? { hf_token } : {}) as any);
    
    const referenceAudioPath = path.join(process.cwd(), "public", "voice_sample.wav");
    
    if (!fs.existsSync(referenceAudioPath)) {
      return NextResponse.json({ error: "Missing voice sample" }, { status: 500 });
    }

    const fileBuffer = fs.readFileSync(referenceAudioPath);
    const audioBlob = new Blob([fileBuffer], { type: "audio/wav" }) as any;

    const result = await client.predict("/clone", [
      text, 
      handle_file(audioBlob), 
    ]) as any;

    const audioUrl = result?.data?.[0]?.url;

    if (!audioUrl) {
       return NextResponse.json({ error: "Failed to generate audio" }, { status: 500 });
    }

    // Fetch the audio file from Gradio
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return NextResponse.json({ error: "Failed to fetch audio from provider" }, { status: 500 });
    }

    const audioBuffer = await audioRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
      },
    });

  } catch (error: any) {
    console.error("TTS API Error:", error);
    return NextResponse.json({ error: JSON.stringify(error, Object.getOwnPropertyNames(error)) }, { status: 500 });
  }
}
