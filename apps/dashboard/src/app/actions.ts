"use server";

import { db, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

export async function getDashboardData() {
  try {
    // 1. Get total flows count
    const totalFlowsResult = await db.select({ count: sql`count(*)` }).from(schema.flows);
    const totalFlows = Number(totalFlowsResult[0]?.count || 0);

    // 2. Get active flows count
    const activeFlowsResult = await db.select({ count: sql`count(*)` }).from(schema.flows).where(eq(schema.flows.isActive, true));
    const activeFlows = Number(activeFlowsResult[0]?.count || 0);

    // 3. Get total steps count
    const totalStepsResult = await db.select({ count: sql`count(*)` }).from(schema.steps);
    const totalSteps = Number(totalStepsResult[0]?.count || 0);

    // 4. Get total events count (analytics)
    const totalEventsResult = await db.select({ count: sql`count(*)` }).from(schema.events);
    const totalEvents = Number(totalEventsResult[0]?.count || 0);

    return {
      success: true,
      stats: {
        totalFlows,
        activeFlows,
        totalSteps,
        totalEvents,
      }
    };
  } catch (error: any) {
    console.error("Error in getDashboardData:", error);
    return {
      success: false,
      error: error.message,
      stats: { totalFlows: 0, activeFlows: 0, totalSteps: 0, totalEvents: 0 }
    };
  }
}

export async function getFlowsList() {
  try {
    const allFlows = await db.select().from(schema.flows);
    
    const flowsWithSteps = await Promise.all(
      allFlows.map(async (flow: any) => {
        const steps = await db
          .select()
          .from(schema.steps)
          .where(eq(schema.steps.flowId, flow.id))
          .orderBy(schema.steps.stepIndex);
        return {
          ...flow,
          steps,
        };
      })
    );

    return { success: true, flows: flowsWithSteps };
  } catch (error: any) {
    console.error("Error in getFlowsList:", error);
    return { success: false, error: error.message, flows: [] };
  }
}

export async function toggleFlowAction(id: string, isActive: boolean) {
  try {
    await db
      .update(schema.flows)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(eq(schema.flows.id, id));
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleFlowAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteFlowAction(id: string) {
  try {
    await db.delete(schema.flows).where(eq(schema.flows.id, id));
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteFlowAction:", error);
    return { success: false, error: error.message };
  }
}

export async function saveFlowAction(formData: {
  id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps: Array<{
    id?: string;
    title: string;
    content: string;
    targetSelector?: string;
    placement?: string;
    stepIndex?: number;
  }>;
}) {
  try {
    const flowId = formData.id || crypto.randomUUID();
    const { name, description, isActive, steps } = formData;

    await db.transaction(async (tx: any) => {
      // 1. Check if flow exists
      const existingFlow = await tx.select().from(schema.flows).where(eq(schema.flows.id, flowId));

      if (existingFlow.length > 0) {
        await tx
          .update(schema.flows)
          .set({
            name,
            description: description || null,
            isActive,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.flows.id, flowId));
      } else {
        await tx.insert(schema.flows).values({
          id: flowId,
          name,
          description: description || null,
          isActive,
        });
      }

      // 2. Clear old steps
      await tx.delete(schema.steps).where(eq(schema.steps.flowId, flowId));

      // 3. Insert new steps
      if (steps && steps.length > 0) {
        const stepsValues = steps.map((step, idx) => ({
          id: step.id || crypto.randomUUID(),
          flowId,
          title: step.title,
          content: step.content,
          targetSelector: step.targetSelector || null,
          placement: step.placement || 'bottom',
          stepIndex: step.stepIndex !== undefined ? step.stepIndex : idx,
        }));
        await tx.insert(schema.steps).values(stepsValues);
      }
    });

    revalidatePath('/');
    return { success: true, flowId };
  } catch (error: any) {
    console.error("Error in saveFlowAction:", error);
    return { success: false, error: error.message };
  }
}
