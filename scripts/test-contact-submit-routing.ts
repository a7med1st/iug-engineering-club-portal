import {
  ComplaintType,
  StudyLevel,
} from "@prisma/client";

import {
  createInitialRoutingRecords,
  findInitialContactAssignee,
} from "../lib/contact-routing";
import { prisma } from "../lib/prisma";

async function main() {
  const department = await prisma.department.findFirst({
    select: { id: true, nameAr: true },
    orderBy: { createdAt: "asc" },
  });

  if (!department) {
    throw new Error("No department is available for the contact test.");
  }

  const assignment = await findInitialContactAssignee(
    department.id,
  );
  let requestId: string | null = null;

  try {
    requestId = await prisma.$transaction(async (transaction) => {
      const request = await transaction.complaint.create({
        data: {
          studentName: "اختبار آلي مؤقت",
          departmentId: department.id,
          studyLevel: StudyLevel.SECOND,
          type: ComplaintType.INQUIRY,
          details:
            "اختبار تكاملي مؤقت لمسار إرسال وتوجيه ملاحظات بوابة التواصل.",
          wantsReply: false,
          assignedToId: assignment?.userId ?? null,
          assignedStructureItemId:
            assignment?.structureItemId ?? null,
          assignedAt: assignment ? new Date() : null,
        },
        select: { id: true },
      });

      await createInitialRoutingRecords(
        transaction,
        assignment,
        "COMPLAINT",
        request.id,
        `اختبار توجيه مؤقت لقسم ${department.nameAr}.`,
      );

      return request.id;
    });

    const saved = await prisma.complaint.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        assignedToId: true,
        assignedStructureItemId: true,
      },
    });
    const routingEvents = await prisma.contactRoutingEvent.count({
      where: {
        requestKind: "COMPLAINT",
        requestId,
      },
    });

    if (!saved) {
      throw new Error("The temporary complaint was not saved.");
    }

    if (assignment && routingEvents !== 1) {
      throw new Error("The routing event was not created.");
    }

    console.log(
      JSON.stringify({
        saved: true,
        department: department.nameAr,
        assignedTo: assignment?.userName ?? null,
        routingEvents,
      }),
    );
  } finally {
    if (requestId) {
      await prisma.$transaction([
        prisma.notification.deleteMany({
          where: {
            href: `/admin/contact?focus=complaint-${requestId}`,
          },
        }),
        prisma.contactRoutingEvent.deleteMany({
          where: {
            requestKind: "COMPLAINT",
            requestId,
          },
        }),
        prisma.complaint.deleteMany({
          where: { id: requestId },
        }),
      ]);
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
