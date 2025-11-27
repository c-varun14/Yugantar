import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const systemPrompt = `You are an expert animation instruction generator. Convert the user's text description into detailed, structured animation instructions.

Your output should be a JSON object with the following structure:
{
  "scene": {
    "title": "Brief title of the animation",
    "description": "Detailed description of what the animation demonstrates",
    "canvas": {
      "width": 800,
      "height": 600,
      "backgroundColor": "#ffffff"
    }
  },
  "objects": [
    {
      "id": "object1",
      "type": "shape|text|graph|chart|bar|arrow|circle|square|line",
      "properties": {
        "position": { "x": 100, "y": 100 },
        "size": { "width": 50, "height": 50 },
        "color": "#3b82f6",
        "label": "Optional label text"
      },
      "initialState": {}
    }
  ],
  "animations": [
    {
      "id": "anim1",
      "targetObjectId": "object1",
      "type": "move|grow|fade|rotate|colorChange|morph",
      "duration": 2000,
      "delay": 0,
      "easing": "easeInOut",
      "properties": {
        "from": {},
        "to": {}
      },
      "description": "What this animation does"
    }
  ],
  "timeline": [
    {
      "time": 0,
      "action": "description of what happens at this time",
      "animationIds": ["anim1"]
    }
  ],
  "controls": {
    "playPause": true,
    "reset": true,
    "speedControl": true,
    "stepForward": false,
    "stepBackward": false
  },
  "narrativeGuide": {
    "introduction": "Brief introduction to what the animation will demonstrate",
    "steps": [
      {
        "timestamp": 0,
        "timeInSeconds": 0,
        "text": "Narrative description of what happens at this moment",
        "highlight": "Key concept or object to focus on"
      }
    ],
    "conclusion": "Summary of what was demonstrated"
  }
}

IMPORTANT GUIDELINES:
- For algorithms (sorting, searching): Break down into discrete steps with clear state transitions
- For math concepts: Define geometric shapes, their relationships, and how they transform
- For graphs/plots: Define data points, axes, and how the curve/plot is drawn
- For physics: Define objects, forces, and how they interact over time
- Animations should be detailed enough that a developer can implement them
- Use descriptive IDs and clear property definitions
- Timeline should show the sequence of events clearly
- Duration should be in milliseconds (aim for 20-30 seconds total animation time so narration is not rushed)

NARRATIVE GUIDE REQUIREMENTS:
- The narrativeGuide.steps array should have one entry for each significant moment in the animation
- Each step should have a timestamp in milliseconds (matching timeline entries)
- timeInSeconds should be the same timestamp converted to seconds (for readability)
- The text should be clear, educational, and suitable for narration/audio generation, paced at roughly 120-140 words per minute (about 2-3 words per second).
- Prefer a few concise sentences per step rather than dense paragraphs, so each step can be comfortably voiced over.
- Steps should be spaced throughout the animation duration (not all at the start)
- Introduction should set context, conclusion should summarize key learnings
- Highlight field should point to important visual elements being discussed

Return ONLY valid JSON, no markdown, no code fences, no explanations.`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Gemini API key is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in your environment.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or empty 'prompt' in request body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      prompt: `Convert this animation request into detailed instructions: ${prompt.trim()}`,
      temperature: 0.7,
    });

    // Use toTextStreamResponse for simpler client-side parsing
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error generating instructions:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate animation instructions." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
