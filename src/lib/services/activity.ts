import { ActivityVerb } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface ActivityInput {
  projectId: string;
  actorId?: string | null;
  verb: ActivityVerb;
  entity: string;
  entityId?: string | null;
  summary: string;
}

/**
 * Records a project activity. Best-effort: failures are logged but never
 * break the originating request.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        projectId: input.projectId,
        actorId: input.actorId ?? null,
        verb: input.verb,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (err) {
    console.error("[activity] failed to record:", err);
  }
}
