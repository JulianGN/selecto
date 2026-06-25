import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

type FlowRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StepInput = {
  id?: string;
  title: string;
  content: string;
  targetSelector?: string | null;
  placement?: string;
  stepIndex?: number;
};

type FlowPayload = {
  id?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  steps?: StepInput[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('id');

    // Query all active flows
    const activeFlows = await db
      .select()
      .from(schema.flows)
      .where(eq(schema.flows.isActive, true));

    const targetFlows = flowId 
      ? activeFlows.filter((flow: FlowRecord) => flow.id === flowId)
      : activeFlows;

    // Fetch steps for each flow
    const flowsWithSteps = await Promise.all(
      targetFlows.map(async (flow: FlowRecord) => {
        const flowSteps = await db
          .select()
          .from(schema.steps)
          .where(eq(schema.steps.flowId, flow.id))
          .orderBy(schema.steps.stepIndex);
        
        return {
          ...flow,
          steps: flowSteps,
        };
      })
    );

    return NextResponse.json({ success: true, flows: flowsWithSteps });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FlowPayload;
    const { id, name, description, isActive, steps } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id or name' },
        { status: 400 }
      );
    }

    await db.transaction(async (tx: typeof db) => {
      // 1. Insert or update flow
      const existingFlow = await tx
        .select()
        .from(schema.flows)
        .where(eq(schema.flows.id, id));

      if (existingFlow.length > 0) {
        await tx
          .update(schema.flows)
          .set({
            name,
            description,
            isActive: isActive !== undefined ? isActive : existingFlow[0].isActive,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.flows.id, id));
      } else {
        await tx.insert(schema.flows).values({
          id,
          name,
          description,
          isActive: !!isActive,
        });
      }

      // 2. Delete existing steps for this flow to overwrite
      await tx
        .delete(schema.steps)
        .where(eq(schema.steps.flowId, id));

      // 3. Insert new steps if provided
      if (steps && Array.isArray(steps) && steps.length > 0) {
        const stepsValues = steps.map((step: StepInput, idx: number) => ({
          id: step.id || crypto.randomUUID(),
          flowId: id,
          title: step.title,
          content: step.content,
          targetSelector: step.targetSelector || null,
          placement: step.placement || 'bottom',
          stepIndex: step.stepIndex !== undefined ? step.stepIndex : idx,
        }));
        
        await tx.insert(schema.steps).values(stepsValues);
      }
    });

    return NextResponse.json({ success: true, message: 'Flow saved successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
