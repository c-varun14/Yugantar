import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma-client";

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
- Play/Pause button (toggle animation) - MUST work correctly
- Reset button (When clicked, the animation should start from the beginning and play again.) - MUST work correctly
- Speed control slider (0.5x to 2x speed) - MUST work correctly
- Step forward button (advances animation by one frame or one logical step) - MUST work correctly
- Step backward button (goes back one frame or one logical step) - MUST work correctly
- All controls must be in a separate <div> ABOVE the canvas element (at the top, before the canvas)
- CRITICAL: Step forward/backward buttons MUST be fully functional. They should:
  * Step forward: Increment currentFrame by 1 (or move to next logical step), pause animation, and redraw
  * Step backward: Decrement currentFrame by 1 (or move to previous logical step), pause animation, and redraw
  * Ensure currentFrame stays within bounds (0 to totalFrames)
  * When stepping, set isPlaying to false to pause the animation
- EXTERNAL CONTROL COMPATIBILITY: Expose these functions globally (on window object) so external controls can call them:
  * window.stepForward = function() { /* step forward logic */ }
  * window.stepBackward = function() { /* step backward logic */ }
  * window.resetAnimation = function() { /* reset logic */ }
  * window.playAnimation = function() { /* play logic */ }
  * Also listen for postMessage events: window.addEventListener('message', (e) => { if (e.data.type === 'stepForward') stepForward(); })

TECHNICAL REQUIREMENTS:
- Complete HTML file with <!DOCTYPE html>
- MUST use HTML5 Canvas API directly (NO D3.js, NO p5.js, NO external libraries)
- Use native Canvas 2D context for all drawing operations
- Canvas should be the ONLY element that gets recorded (no controls, no frame counters on canvas)
- Canvas dimensions: 800x600 or 1000x700 (adjust based on content)
- Structure: Controls div ABOVE canvas, then <canvas id="animationCanvas"></canvas> below controls
- Controls div should be positioned OUTSIDE and ABOVE the canvas (at the top)
- Canvas should be clean - no frame counters, no debug info visible on canvas
- Only the animation content should be on the canvas
- CRITICAL: Canvas must have max-height: 70vh style to ensure it fits within viewport
- Canvas should use width: 100% and max-height: 70vh with object-fit: contain or similar to maintain aspect ratio
- Use requestAnimationFrame for smooth animation loop
- All text, shapes, and animations must be drawn using Canvas API methods
- Modern, clean styling with good contrast
- Responsive design (works on different screen sizes)
- Add labels and titles INSIDE the canvas using fillText/strokeText
- The main container/body layout should use flexbox with flex-direction: column to stack controls at top, then canvas
- Container should ensure all content (controls + canvas) fits within viewport without scrolling

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
  let animationId = null;
  
  function drawFrame(frame) {
    // Draw animation based on frame number
    // This function should be able to draw any frame from 0 to totalFrames
  }
  
  function animate() {
    if (!animState.isPlaying) return;
    
    // Draw current frame
    drawFrame(animState.currentFrame);
    
    // Increment frame
    animState.currentFrame += animState.speed;
    
    if (animState.currentFrame < animState.totalFrames) {
      animationId = requestAnimationFrame(animate);
    } else {
      animState.isPlaying = false;
      animState.currentFrame = animState.totalFrames;
      drawFrame(animState.currentFrame);
    }
  }
  
  // CRITICAL: Step forward function (MUST BE IMPLEMENTED)
  function stepForward() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (animState.currentFrame < animState.totalFrames) {
      animState.currentFrame = Math.min(animState.currentFrame + 1, animState.totalFrames);
    }
    drawFrame(animState.currentFrame);
  }
  
  // CRITICAL: Step backward function (MUST BE IMPLEMENTED)
  function stepBackward() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (animState.currentFrame > 0) {
      animState.currentFrame = Math.max(animState.currentFrame - 1, 0);
    }
    drawFrame(animState.currentFrame);
  }
  
  // Expose functions globally for external control
  window.stepForward = stepForward;
  window.stepBackward = stepBackward;
  window.resetAnimation = function() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    animState.currentFrame = 0;
    drawFrame(0);
  };
  window.playAnimation = function() {
    if (!animState.isPlaying) {
      animState.isPlaying = true;
      animate();
    }
  };
  
  // Listen for postMessage events from parent window
  window.addEventListener('message', function(e) {
    if (e.data.type === 'stepForward') stepForward();
    if (e.data.type === 'stepBackward') stepBackward();
  });

MEDIARECORDER INTEGRATION:
- Canvas must support recording via canvas.captureStream(30)
- Example structure:
  <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; min-height: 100vh; box-sizing: border-box;">
    <div style="margin-bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
      <!-- Controls here: buttons, sliders, etc. -->
    </div>
    <canvas id="animationCanvas" width="800" height="600" style="border: 1px solid #ccc; background: white; max-height: 70vh; width: 100%; object-fit: contain;"></canvas>
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
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  let body: GenerateVisualizationRequestBody | null = null;
  
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json(
        {
          code: "",
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }
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

    body = (await req.json()) as GenerateVisualizationRequestBody;

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
- Play/Pause button (toggle animation) - MUST work correctly
- Reset button (When clicked, the animation should start from the beginning and play again.) - MUST work correctly
- Speed control slider (0.5x to 2x speed) - MUST work correctly
- Step forward button (advances animation by one frame or one logical step) - MUST work correctly
- Step backward button (goes back one frame or one logical step) - MUST work correctly
- All controls must be in a separate <div> ABOVE the canvas element (at the top, before the canvas)
- CRITICAL: Step forward/backward buttons MUST be fully functional. They should:
  * Step forward: Increment currentFrame by 1 (or move to next logical step), pause animation, and redraw
  * Step backward: Decrement currentFrame by 1 (or move to previous logical step), pause animation, and redraw
  * Ensure currentFrame stays within bounds (0 to totalFrames)
  * When stepping, set isPlaying to false to pause the animation
- EXTERNAL CONTROL COMPATIBILITY: Expose these functions globally (on window object) so external controls can call them:
  * window.stepForward = function() { /* step forward logic */ }
  * window.stepBackward = function() { /* step backward logic */ }
  * window.resetAnimation = function() { /* reset logic */ }
  * window.playAnimation = function() { /* play logic */ }
  * Also listen for postMessage events: window.addEventListener('message', (e) => { if (e.data.type === 'stepForward') stepForward(); })

TECHNICAL REQUIREMENTS:
- Complete HTML file with <!DOCTYPE html>
- MUST use HTML5 Canvas API directly (NO D3.js, NO p5.js, NO external libraries)
- Use native Canvas 2D context for all drawing operations
- Canvas should be the ONLY element that gets recorded (no controls, no frame counters on canvas)
- Canvas dimensions: 800x600 or 1000x700 (adjust based on content)
- Structure: Controls div ABOVE canvas, then <canvas id="animationCanvas"></canvas> below controls
- Controls div should be positioned OUTSIDE and ABOVE the canvas (at the top)
- Canvas should be clean - no frame counters, no debug info visible on canvas
- Only the animation content should be on the canvas
- CRITICAL: Canvas must have max-height: 70vh style to ensure it fits within viewport
- Canvas should use width: 100% and max-height: 70vh with object-fit: contain or similar to maintain aspect ratio
- Use requestAnimationFrame for smooth animation loop
- All text, shapes, and animations must be drawn using Canvas API methods
- Modern, clean styling with good contrast
- Responsive design (works on different screen sizes)
- Add labels and titles INSIDE the canvas using fillText/strokeText
- The main container/body layout should use flexbox with flex-direction: column to stack controls at top, then canvas
- Container should ensure all content (controls + canvas) fits within viewport without scrolling

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
  let animationId = null;
  
  function drawFrame(frame) {
    // Draw animation based on frame number
    // This function should be able to draw any frame from 0 to totalFrames
  }
  
  function animate() {
    if (!animState.isPlaying) return;
    
    // Draw current frame
    drawFrame(animState.currentFrame);
    
    // Increment frame
    animState.currentFrame += animState.speed;
    
    if (animState.currentFrame < animState.totalFrames) {
      animationId = requestAnimationFrame(animate);
    } else {
      animState.isPlaying = false;
      animState.currentFrame = animState.totalFrames;
      drawFrame(animState.currentFrame);
    }
  }
  
  // CRITICAL: Step forward function (MUST BE IMPLEMENTED)
  function stepForward() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (animState.currentFrame < animState.totalFrames) {
      animState.currentFrame = Math.min(animState.currentFrame + 1, animState.totalFrames);
    }
    drawFrame(animState.currentFrame);
  }
  
  // CRITICAL: Step backward function (MUST BE IMPLEMENTED)
  function stepBackward() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (animState.currentFrame > 0) {
      animState.currentFrame = Math.max(animState.currentFrame - 1, 0);
    }
    drawFrame(animState.currentFrame);
  }
  
  // Expose functions globally for external control
  window.stepForward = stepForward;
  window.stepBackward = stepBackward;
  window.resetAnimation = function() {
    animState.isPlaying = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    animState.currentFrame = 0;
    drawFrame(0);
  };
  window.playAnimation = function() {
    if (!animState.isPlaying) {
      animState.isPlaying = true;
      animate();
    }
  };
  
  // Listen for postMessage events from parent window
  window.addEventListener('message', function(e) {
    if (e.data.type === 'stepForward') stepForward();
    if (e.data.type === 'stepBackward') stepBackward();
  });

MEDIARECORDER INTEGRATION:
- Canvas must support recording via canvas.captureStream(30)
- Example structure:
  <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; min-height: 100vh; box-sizing: border-box;">
    <div style="margin-bottom: 20px; width: 100%; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
      <!-- Controls here: buttons, sliders, etc. -->
    </div>
    <canvas id="animationCanvas" width="800" height="600" style="border: 1px solid #ccc; background: white; max-height: 70vh; width: 100%; object-fit: contain;"></canvas>
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

    // Save to database after code generation
    try {
      const visualizationEndedAt = new Date();
      let parsedInstructions = null;
      try {
        parsedInstructions = instructions ? JSON.parse(instructions) : null;
      } catch {
        // If instructions is not valid JSON, store as null
      }
      
      await prisma.promptLog.create({
        data: {
          userId: session.user.id,
          prompt: inputText,
          instructions: parsedInstructions ?? undefined,
          narrativeGuide: narrativeGuide ?? undefined,
          visualizationHtml: code,
          status: validHtml ? "VISUALIZATION_COMPLETE" : "FAILED",
          errorMessage: validHtml
            ? undefined
            : "Generated output may not be a complete HTML document. Please validate before use.",
          visualizationEndedAt: visualizationEndedAt,
        },
      });
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
      // Don't fail the request if database save fails
    }

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

    // Try to save error to database
    if (session?.user && body) {
      try {
        const instructions = body?.instructions?.trim();
        const prompt = body?.prompt?.trim();
        const inputText = instructions || prompt;
        
        if (inputText) {
          let parsedInstructions = null;
          try {
            parsedInstructions = instructions ? JSON.parse(instructions) : null;
          } catch {
            // If instructions is not valid JSON, store as null
          }
          
          await prisma.promptLog.create({
            data: {
              userId: session.user.id,
              prompt: inputText,
              instructions: parsedInstructions ?? undefined,
              narrativeGuide: body?.narrativeGuide ?? undefined,
              status: "FAILED",
              errorMessage: error instanceof Error ? error.message : "Failed to generate visualization HTML.",
            },
          });
        }
      } catch (dbError) {
        console.error("Error saving error to database:", dbError);
      }
    }

    return NextResponse.json(
      {
        code: "",
        error: "Failed to generate visualization HTML.",
      },
      { status: 500 }
    );
  }
}
