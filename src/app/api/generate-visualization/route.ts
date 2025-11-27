import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

interface GenerateVisualizationRequestBody {
  prompt?: string;
  instructions?: string;
  narrativeGuide?: {
    introduction?: string;
    steps?: Array<{
      timestamp: number;
      timeInSeconds: number;
      text: string;
      highlight?: string;
    }>;
    conclusion?: string;
  };
}

interface GenerateVisualizationResponseBody {
  code: string;
  error?: string;
}

const systemPrompt = `You are an expert visualization code generator. Generate a complete, self-contained HTML page that visualizes: {user_prompt}

CRITICAL ANIMATION REQUIREMENTS:
- Animations MUST last at least 15-20 seconds minimum (450-600 frames at 30 FPS) so the pacing is comfortable for narration and audio.
- Use frame-based animation (not time-based) for consistent recording
- Frame rate: 30 FPS (30 frames per second)
- Calculate totalFrames: totalFrames = durationSeconds * 30
- Use slow, smooth transitions (not rushed)
- For algorithms: show EACH step clearly with frame-based delays
- For math: build up the concept gradually, showing construction process frame-by-frame
- For graphs: animate drawing the plot point-by-point or curve smoothly frame-by-frame
- Use requestAnimationFrame for smooth animation loop
- NEVER make instant changes - everything should transition smoothly across frames
- It is OK if the final animation runs longer than initially requested; prioritize clear explanation over strict duration.

REQUIRED CONTROLS (MUST INCLUDE - OUTSIDE CANVAS):
- Play/Pause button (toggle animation)
- Reset button (When clicked, the animation should start from the beginning and play again.)
- Speed control slider (0.5x to 2x speed)
- Step forward/backward buttons (for step-by-step viewing if applicable)
- All controls must be in a separate <div> BELOW the canvas element

TECHNICAL REQUIREMENTS:
- Complete HTML file with <!DOCTYPE html>
- MUST use HTML5 Canvas API directly (NO D3.js, NO p5.js, NO external libraries)
- Use native Canvas 2D context for all drawing operations
- Canvas should be the ONLY element that gets recorded (no controls, no frame counters on canvas)
- Canvas dimensions: 800x600 or 1000x700 (adjust based on content)
- Structure: <canvas id="animationCanvas"></canvas> with controls in separate div
- Controls div should be positioned OUTSIDE and BELOW the canvas
- Canvas should be clean - no frame counters, no debug info visible on canvas
- Only the animation content should be on the canvas
- Use requestAnimationFrame for smooth animation loop
- All text, shapes, and animations must be drawn using Canvas API methods
- Modern, clean styling with good contrast
- Responsive design (works on different screen sizes)
- Add labels and titles INSIDE the canvas using fillText/strokeText
- The main container/body layout should center the canvas horizontally and vertically in the viewport using flexbox (align-items: center; justify-content: center; min-height: 100vh; padding).

ANIMATION STATE MANAGEMENT:
- Use a global animation state object: { isPlaying: true, speed: 1, currentFrame: 0, totalFrames: 300 }
- Use frame-based animation (not time-based) for consistent recording
- Frame rate: 30 FPS (30 frames per second)
- Calculate totalFrames based on desired duration: totalFrames = durationSeconds * 30
- All animations should respect isPlaying flag
- Speed multiplier should affect frame increment rate
- Example pattern:
  
  let animState = { isPlaying: true, speed: 1, currentFrame: 0, totalFrames: 300 };
  const FPS = 30;
  
  function animate() {
    if (!animState.isPlaying) return;
    
    // Draw current frame
    drawFrame(animState.currentFrame);
    
    // Increment frame
    animState.currentFrame += animState.speed;
    
    if (animState.currentFrame < animState.totalFrames) {
      requestAnimationFrame(animate);
    } else {
      animState.isPlaying = false;
      animState.currentFrame = animState.totalFrames;
    }
  }

MEDIARECORDER INTEGRATION:
- Canvas must support recording via canvas.captureStream(30)
- Example structure:
  <div style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
    <canvas id="animationCanvas" width="800" height="600" style="border: 1px solid #ccc; background: white;"></canvas>
    <div style="margin-top: 20px;">
      <!-- Controls here: buttons, sliders, etc. -->
    </div>
  </div>

CANVAS DRAWING REQUIREMENTS:
- Use canvas.getContext('2d') for 2D rendering
- Clear canvas each frame: ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
- Use interpolation functions for smooth transitions between frames
- Draw all shapes, lines, text directly on canvas
- Use appropriate colors, line widths, and styling
- Text: ctx.font, ctx.fillText(), ctx.strokeText()
- Shapes: ctx.fillRect(), ctx.strokeRect(), ctx.arc(), ctx.beginPath(), ctx.lineTo()
- Colors: ctx.fillStyle, ctx.strokeStyle
- Transparency: ctx.globalAlpha
- CRITICAL: All animations must be CENTERED in the canvas. Calculate center as: centerX = canvas.width / 2, centerY = canvas.height / 2
- Use ctx.save() and ctx.translate(centerX, centerY) to center content, then ctx.restore() after drawing
- SUBTITLES: Display narrative text as subtitles at the bottom of the canvas (y position: canvas.height - 40)
- Subtitles should match the current animation frame/time and be synchronized with the animation speed
- Subtitle styling: ctx.font = '20px Arial', ctx.fillStyle = '#000000', ctx.textAlign = 'center'
- Draw subtitle background: ctx.fillStyle = 'rgba(255, 255, 255, 0.8)', ctx.fillRect(0, canvas.height - 60, canvas.width, 60)
- Then draw subtitle text on top

SPECIFIC EXAMPLES:
- Bubble sort: Draw bars using canvas.fillRect(), animate comparisons and swaps frame-by-frame
- Pythagorean theorem: Draw squares using canvas.strokeRect() and canvas.fillRect(), animate growth frame-by-frame
- Sine wave: Draw curve using canvas.beginPath() and canvas.lineTo(), animate point-by-point
- Vector addition: Draw arrows using canvas paths, animate translation frame-by-frame

CRITICAL: The canvas element should contain ONLY the animation. All UI controls, frame counters, progress bars, and status messages must be in separate HTML elements OUTSIDE the canvas. The canvas will be recorded as video, so it must be clean and professional. No frame numbers, no debug text, no UI elements on the canvas itself.

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

    const instructions = body?.instructions?.trim();
    const prompt = body?.prompt?.trim();
    const narrativeGuide = body?.narrativeGuide;

    // Prefer instructions over prompt, but support both for backward compatibility
    const inputText = instructions || prompt;

    if (!inputText) {
      return NextResponse.json(
        {
          code: "",
          error: "Missing or empty 'instructions' or 'prompt' in request body.",
        },
        { status: 400 }
      );
    }

    // If instructions are provided, use them directly; otherwise use the prompt
    const composedPrompt = instructions
      ? `You are an expert visualization code generator. Generate a complete, self-contained HTML page based on these detailed animation instructions:

${instructions}
${
  narrativeGuide
    ? `\nNARRATIVE GUIDE FOR SUBTITLES:\n${JSON.stringify(
        narrativeGuide,
        null,
        2
      )}\n\nIMPORTANT: Use the narrativeGuide.steps array to display synchronized subtitles on the canvas. Each step has a timestamp (in milliseconds) and text. Display the appropriate subtitle text based on the current animation frame/time. The subtitle should appear at the bottom of the canvas and match the animation speed.`
    : ""
}

CRITICAL ANIMATION REQUIREMENTS:
- Animations MUST last at least 15-20 seconds minimum (450-600 frames at 30 FPS) so the pacing is comfortable for narration and audio.
- Use frame-based animation (not time-based) for consistent recording
- Frame rate: 30 FPS (30 frames per second)
- Calculate totalFrames: totalFrames = durationSeconds * 30
- Use slow, smooth transitions (not rushed)
- For algorithms: show EACH step clearly with frame-based delays
- For math: build up the concept gradually, showing construction process frame-by-frame
- For graphs: animate drawing the plot point-by-point or curve smoothly frame-by-frame
- Use requestAnimationFrame for smooth animation loop
- NEVER make instant changes - everything should transition smoothly across frames
- It is OK if the final animation runs longer than initially requested; prioritize clear explanation over strict duration.

REQUIRED CONTROLS (MUST INCLUDE - OUTSIDE CANVAS):
- Play/Pause button (toggle animation)
- Reset button (When clicked, the animation should start from the beginning and play again.)
- Speed control slider (0.5x to 2x speed)
- Step forward/backward buttons (for step-by-step viewing if applicable)
- All controls must be in a separate <div> BELOW the canvas element

TECHNICAL REQUIREMENTS:
- Complete HTML file with <!DOCTYPE html>
- MUST use HTML5 Canvas API directly (NO D3.js, NO p5.js, NO external libraries)
- Use native Canvas 2D context for all drawing operations
- Canvas should be the ONLY element that gets recorded (no controls, no frame counters on canvas)
- Canvas dimensions: 800x600 or 1000x700 (adjust based on content)
- Structure: <canvas id="animationCanvas"></canvas> with controls in separate div
- Controls div should be positioned OUTSIDE and BELOW the canvas
- Canvas should be clean - no frame counters, no debug info visible on canvas
- Only the animation content should be on the canvas
- Use requestAnimationFrame for smooth animation loop
- All text, shapes, and animations must be drawn using Canvas API methods
- Modern, clean styling with good contrast
- Responsive design (works on different screen sizes)
- Add labels and titles INSIDE the canvas using fillText/strokeText
- The main container/body layout should center the canvas horizontally and vertically in the viewport using flexbox (align-items: center; justify-content: center; min-height: 100vh; padding).

ANIMATION STATE MANAGEMENT:
- Use a global animation state object: { isPlaying: true, speed: 1, currentFrame: 0, totalFrames: 300 }
- Use frame-based animation (not time-based) for consistent recording
- Frame rate: 30 FPS (30 frames per second)
- Calculate totalFrames based on desired duration: totalFrames = durationSeconds * 30
- All animations should respect isPlaying flag
- Speed multiplier should affect frame increment rate
- Example pattern:
  
  let animState = { isPlaying: true, speed: 1, currentFrame: 0, totalFrames: 300 };
  const FPS = 30;
  
  function animate() {
    if (!animState.isPlaying) return;
    
    // Draw current frame
    drawFrame(animState.currentFrame);
    
    // Increment frame
    animState.currentFrame += animState.speed;
    
    if (animState.currentFrame < animState.totalFrames) {
      requestAnimationFrame(animate);
    } else {
      animState.isPlaying = false;
      animState.currentFrame = animState.totalFrames;
    }
  }

MEDIARECORDER INTEGRATION:
- Canvas must support recording via canvas.captureStream(30)
- Example structure:
  <div style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
    <canvas id="animationCanvas" width="800" height="600" style="border: 1px solid #ccc; background: white;"></canvas>
    <div style="margin-top: 20px;">
      <!-- Controls here: buttons, sliders, etc. -->
    </div>
  </div>

CANVAS DRAWING REQUIREMENTS:
- Use canvas.getContext('2d') for 2D rendering
- Clear canvas each frame: ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
- Use interpolation functions for smooth transitions between frames
- Draw all shapes, lines, text directly on canvas
- Use appropriate colors, line widths, and styling
- Text: ctx.font, ctx.fillText(), ctx.strokeText()
- Shapes: ctx.fillRect(), ctx.strokeRect(), ctx.arc(), ctx.beginPath(), ctx.lineTo()
- Colors: ctx.fillStyle, ctx.strokeStyle
- Transparency: ctx.globalAlpha
- CRITICAL: All animations must be CENTERED in the canvas. Calculate center as: centerX = canvas.width / 2, centerY = canvas.height / 2
- Use ctx.save() and ctx.translate(centerX, centerY) to center content, then ctx.restore() after drawing
- SUBTITLES: Display narrative text as subtitles at the bottom of the canvas (y position: canvas.height - 40)
- Subtitles should match the current animation frame/time and be synchronized with the animation speed
- Subtitle styling: ctx.font = '20px Arial', ctx.fillStyle = '#000000', ctx.textAlign = 'center'
- Draw subtitle background: ctx.fillStyle = 'rgba(255, 255, 255, 0.8)', ctx.fillRect(0, canvas.height - 60, canvas.width, 60)
- Then draw subtitle text on top

SPECIFIC EXAMPLES:
- Bubble sort: Draw bars using canvas.fillRect(), animate comparisons and swaps frame-by-frame
- Pythagorean theorem: Draw squares using canvas.strokeRect() and canvas.fillRect(), animate growth frame-by-frame
- Sine wave: Draw curve using canvas.beginPath() and canvas.lineTo(), animate point-by-point
- Vector addition: Draw arrows using canvas paths, animate translation frame-by-frame

CRITICAL: The canvas element should contain ONLY the animation. All UI controls, frame counters, progress bars, and status messages must be in separate HTML elements OUTSIDE the canvas. The canvas will be recorded as video, so it must be clean and professional. No frame numbers, no debug text, no UI elements on the canvas itself.

Return ONLY the complete HTML code, no markdown backticks, no explanations.`
      : systemPrompt.replace("{user_prompt}", prompt || "");

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
