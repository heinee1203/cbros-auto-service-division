import { NextRequest, NextResponse } from "next/server";
import {
  getSupplementByToken,
  approveWithSignature,
  denySupplement,
} from "@/lib/services/supplements";

// Public endpoint — no auth required (accessed via approval token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supplement = await getSupplementByToken(token);

  if (!supplement) {
    return NextResponse.json(
      { error: "Supplement not found or approval link has expired" },
      { status: 404 }
    );
  }

  return NextResponse.json(supplement);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();

  const { action, signature, comments } = body as {
    action: "approve" | "deny";
    signature?: string;
    comments?: string;
  };

  if (!action || !["approve", "deny"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve' or 'deny'." },
      { status: 400 }
    );
  }

  try {
    if (action === "approve") {
      if (!signature) {
        return NextResponse.json(
          { error: "Signature is required for approval" },
          { status: 400 }
        );
      }

      const supplement = await approveWithSignature(token, signature, comments);
      return NextResponse.json({
        success: true,
        message: "Supplemental estimate approved",
        supplementNumber: supplement.supplementNumber,
      });
    } else {
      const supplement = await denySupplement(token, comments);
      return NextResponse.json({
        success: true,
        message: "Supplemental estimate denied",
        supplementNumber: supplement.supplementNumber,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process approval",
      },
      { status: 500 }
    );
  }
}
