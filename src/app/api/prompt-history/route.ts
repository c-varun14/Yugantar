import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma-client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const promptLogs = await prisma.promptLog.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        prompt: true,
        instructions: true,
        narrativeGuide: true,
        visualizationHtml: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      logs: promptLogs,
      total: promptLogs.length,
    });
  } catch (error) {
    console.error("Error fetching prompt history:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt history." },
      { status: 500 }
    );
  }
}

