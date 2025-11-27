import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { google, GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { generateText } from "ai";

interface GenerateVisualizationRequestBody {
  prompt?: string;
}

interface GenerateVisualizationResponseBody {
  code: string;
  error?: string;
}

const systemPrompt = `You are an expert visualization code generator. Generate a complete, self-contained HTML page that visualizes: {user_prompt}

CRITICAL ANIMATION REQUIREMENTS:
- Animations MUST last at least 10-15 seconds minimum
- Use slow, smooth transitions (not rushed)
- For algorithms: show EACH step clearly with 500-1000ms delays between operations
- For math: build up the concept gradually, showing construction process
- For graphs: animate drawing the plot point-by-point or curve smoothly
- Use setInterval, setTimeout, or requestAnimationFrame for timing control
- NEVER make instant changes - everything should transition smoothly

REQUIRED CONTROLS (MUST INCLUDE):
- Play/Pause button (toggle animation)
- Reset button (When clicked, the animation should start from the beginning and play again.)
- Speed control slider (0.5x to 2x speed)
- Step forward/backward buttons (for step-by-step viewing if applicable)

TECHNICAL REQUIREMENTS:
- Complete HTML file with <!DOCTYPE html>
- Import libraries via CDN:
  * D3.js: https://cdn.jsdelivr.net/npm/d3@7
  * p5.js: https://cdn.jsdelivr.net/npm/p5@1.7.0/lib/p5.min.js
  * Math.js: https://cdn.jsdelivr.net/npm/mathjs@11.11.0/lib/browser/math.min.js
- Use appropriate library based on visualization type:
  * Math/Geometry: p5.js or Canvas API
  * Algorithms: p5.js with step-by-step animation
  * Data plots: D3.js with smooth transitions
  * Physics: p5.js with continuous animation loop
- Modern, clean styling with good contrast
- Responsive design (works on different screen sizes)
- Add labels, titles, and explanations

ANIMATION STATE MANAGEMENT:
- Use a global animation state object: { isPlaying: false, speed: 1, currentStep: 0 }
- All animations should respect isPlaying flag
- Speed multiplier should affect all setTimeout/setInterval durations
- Example pattern:
  
  let animState = { isPlaying: true, speed: 1, currentStep: 0 };
  
  function animate() {
    if (!animState.isPlaying) return;
    // do animation step
    setTimeout(() => requestAnimationFrame(animate), 1000 / animState.speed);
  }

SPECIFIC EXAMPLES:
- Bubble sort: Show EACH comparison (highlight 2 bars in yellow), then EACH swap (highlight in red), with 800ms between each operation
- Pythagorean theorem: Slowly grow each square over 2-3 seconds each, then show area calculations
- Sine wave: Draw curve smoothly from left to right over 5-6 seconds, then highlight peaks/troughs

Return ONLY the complete HTML code, no markdown backticks, no explanations.`;

function stripMarkdownFences(output: string): string {
  let code = output.trim();

  // Strip leading ``` or ```html fences
  if (code.startsWith("```")) {
    code = code.replace(/^```[a-zA-Z0-9]*\s*/u, "");
  }

  // Strip trailing ``` fences
  if (code.endsWith("```")) {
    code = code.replace(/```+$/u, "");
  }

  return code.trim();
}

function isLikelyCompleteHtml(html: string): boolean {
  const lower = html.toLowerCase();

  return (
    lower.includes("<!doctype html") &&
    lower.includes("<html") &&
    lower.includes("</html>") &&
    lower.includes("<head") &&
    lower.includes("</head>") &&
    lower.includes("<body") &&
    lower.includes("</body>")
  );
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<GenerateVisualizationResponseBody>> {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        {
          code: "",
          error:
            "Gemini API key is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in your environment.",
        },
        { status: 500 }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          code: "",
          error: "Invalid content type. Expected application/json.",
        },
        { status: 400 }
      );
    }

    const body = (await req.json()) as GenerateVisualizationRequestBody;

    const prompt = body?.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        {
          code: "",
          error: "Missing or empty 'prompt' in request body.",
        },
        { status: 400 }
      );
    }

    const composedPrompt = systemPrompt.replace("{user_prompt}", prompt);

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: composedPrompt,
      // providerOptions: {
      //   google: {
      //     thinkingConfig: {
      //       thinkingBudget: 8192,
      //     },
      //   } satisfies GoogleGenerativeAIProviderOptions,
      // },
    });

    const code = stripMarkdownFences(text ?? "");

    if (!code) {
      return NextResponse.json(
        {
          code: "",
          error: "Model returned an empty response.",
        },
        { status: 502 }
      );
    }

    const validHtml = isLikelyCompleteHtml(code);

    return NextResponse.json(
      {
        code,
        ...(validHtml
          ? {}
          : {
              error:
                "Generated output may not be a complete HTML document. Please validate before use.",
            }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating visualization:", error);

    return NextResponse.json(
      {
        code: "",
        error: "Failed to generate visualization HTML.",
      },
      { status: 500 }
    );
  }
}
