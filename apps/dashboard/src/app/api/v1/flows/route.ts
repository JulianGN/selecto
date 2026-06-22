import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export async function GET() {
  try {
    // Query all active flows
    const activeFlows = await db
      .select()
      .from(schema.flows)
      .where(eq(schema.flows.isActive, true));

    // Fetch steps for each flow
    const flowsWithSteps = await Promise.all(
      activeFlows.map(async (flow: any) => {
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, isActive, steps } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id or name' },
        { status: 400 }
      );
    }

    await db.transaction(async (tx: any) => {
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
        const stepsValues = steps.map((step: any, idx: number) => ({
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
