import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels = {
  SUBMITTED: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
} as const;

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join("، ");
  }

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export async function GET(
  _request: Request,
  { params }: Props,
) {
  await requireAdmin();

  const { id } = await params;

  const activity =
    await prisma.activity.findUnique({
      where: {
        id,
      },

      include: {
        registrationForm: {
          include: {
            questions: {
              orderBy: {
                sortOrder: "asc",
              },
            },

            submissions: {
              include: {
                answers: true,

                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,

                    department: {
                      select: {
                        nameAr: true,
                      },
                    },
                  },
                },
              },

              orderBy: {
                submittedAt: "asc",
              },
            },
          },
        },
      },
    });

  if (!activity) {
    return new Response(
      "Activity not found",
      {
        status: 404,
      },
    );
  }

  if (!activity.registrationForm) {
    return new Response(
      "Registration form not found",
      {
        status: 404,
      },
    );
  }

  const form =
    activity.registrationForm;

  /* =====================================================
     EXCEL
  ===================================================== */

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Engineering Club - IUG";

  workbook.created =
    new Date();


  /* =====================================================
     REGISTRANTS SHEET
  ===================================================== */

  const sheet =
    workbook.addWorksheet(
      "بيانات المسجلين",
      {
        views: [
          {
            rightToLeft: true,
            state: "frozen",
            ySplit: 4,
          },
        ],
      },
    );


  /* =====================================================
     ACTIVITY TITLE
  ===================================================== */

  const totalColumns =
    6 +
    form.questions.length;

  sheet.mergeCells(
    1,
    1,
    1,
    Math.max(totalColumns, 6),
  );

  const clubCell =
    sheet.getCell(1, 1);

  clubCell.value =
    "النادي الهندسي - الجامعة الإسلامية بغزة";

  clubCell.font = {
    bold: true,
    size: 18,
    color: {
      argb: "FFFFFFFF",
    },
  };

  clubCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF06182C",
    },
  };

  clubCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.getRow(1).height = 34;


  /* =====================================================
     ACTIVITY NAME
  ===================================================== */

  sheet.mergeCells(
    2,
    1,
    2,
    Math.max(totalColumns, 6),
  );

  const activityCell =
    sheet.getCell(2, 1);

  activityCell.value =
    `بيانات المسجلين في نشاط: ${activity.title}`;

  activityCell.font = {
    bold: true,
    size: 15,
    color: {
      argb: "FF102139",
    },
  };

  activityCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.getRow(2).height = 30;


  /* =====================================================
     SMALL INFO
  ===================================================== */

  sheet.mergeCells(
    3,
    1,
    3,
    Math.max(totalColumns, 6),
  );

  const infoCell =
    sheet.getCell(3, 1);

  infoCell.value =
    `عدد المسجلين: ${form.submissions.length} | السعة: ${activity.capacity}`;

  infoCell.alignment = {
    horizontal: "center",
  };

  infoCell.font = {
    size: 11,
    color: {
      argb: "FF66768C",
    },
  };


  /* =====================================================
     HEADERS
  ===================================================== */

  const basicHeaders = [
    "م",
    "اسم الطالب",
    "البريد الإلكتروني",
    "التخصص",
    "حالة التسجيل",
    "تاريخ التسجيل",
  ];

  /*
   * كل سؤال أنشأه الأدمن
   * يصبح Column تلقائيًا.
   */
  const questionHeaders =
    form.questions.map(
      (question) =>
        question.label,
    );

  const headers = [
    ...basicHeaders,
    ...questionHeaders,
  ];

  const headerRow =
    sheet.addRow(headers);

  headerRow.height = 32;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1688FF",
      },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    cell.border = {
      top: {
        style: "thin",
        color: {
          argb: "FFFFFFFF",
        },
      },

      bottom: {
        style: "thin",
        color: {
          argb: "FFFFFFFF",
        },
      },

      left: {
        style: "thin",
        color: {
          argb: "FFFFFFFF",
        },
      },

      right: {
        style: "thin",
        color: {
          argb: "FFFFFFFF",
        },
      },
    };
  });


  /* =====================================================
     REGISTRANTS
  ===================================================== */

  form.submissions.forEach(
    (submission, index) => {
      const answerMap =
        new Map(
          submission.answers.map(
            (answer) => [
              answer.questionId,
              answer.value,
            ],
          ),
        );

      /*
       * الإجابات مرتبة بنفس ترتيب
       * الأسئلة التي وضعها الأدمن.
       */
      const answers =
        form.questions.map(
          (question) =>
            formatAnswer(
              answerMap.get(
                question.id,
              ),
            ),
        );

      const row =
        sheet.addRow([
          index + 1,

          submission.studentName,

          submission.studentEmail,

          submission.studentDepartment ??
            "غير محدد",

          statusLabels[
            submission.status
          ],

          submission.submittedAt.toLocaleString(
            "ar-PS",
            {
              dateStyle: "medium",
              timeStyle: "short",
            },
          ),

          ...answers,
        ]);


      /* ===============================================
         ROW STYLE
      =============================================== */

      row.eachCell((cell) => {
        cell.alignment = {
          horizontal: "right",
          vertical: "top",
          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: "FFDCE3ED",
            },
          },

          bottom: {
            style: "thin",
            color: {
              argb: "FFDCE3ED",
            },
          },

          left: {
            style: "thin",
            color: {
              argb: "FFDCE3ED",
            },
          },

          right: {
            style: "thin",
            color: {
              argb: "FFDCE3ED",
            },
          },
        };
      });


      /* ===============================================
         ALTERNATING ROWS
      =============================================== */

if (index % 2 === 1) {
  row.eachCell((cell, colNumber) => {
    if (colNumber !== 5) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FFF8FAFC",
        },
      };
    }
  });
}


      /* ===============================================
         STATUS COLOR
      =============================================== */

      const statusCell =
        row.getCell(5);

      statusCell.font = {
        bold: true,
      };

      if (
        submission.status ===
        "APPROVED"
      ) {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFDCFCE7",
          },
        };

        statusCell.font = {
          bold: true,
          color: {
            argb: "FF166534",
          },
        };
      }

      if (
        submission.status ===
        "REJECTED"
      ) {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFFEE2E2",
          },
        };

        statusCell.font = {
          bold: true,
          color: {
            argb: "FF991B1B",
          },
        };
      }

      if (
        submission.status ===
        "SUBMITTED"
      ) {
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFFEF3C7",
          },
        };

        statusCell.font = {
          bold: true,
          color: {
            argb: "FF92400E",
          },
        };
      }
    },
  );


  /* =====================================================
     COLUMN WIDTHS
  ===================================================== */

  sheet.getColumn(1).width = 7;

  sheet.getColumn(2).width = 25;

  sheet.getColumn(3).width = 32;

  sheet.getColumn(4).width = 24;

  sheet.getColumn(5).width = 18;

  sheet.getColumn(6).width = 24;

  /*
   * أعمدة الأسئلة
   */
  for (
    let i = 7;
    i <= headers.length;
    i++
  ) {
    sheet.getColumn(i).width =
      30;
  }


  /* =====================================================
     FILTER
  ===================================================== */

  sheet.autoFilter = {
    from: {
      row: 4,
      column: 1,
    },

    to: {
      row: 4,
      column:
        headers.length,
    },
  };


  /* =====================================================
     EXPORT
  ===================================================== */

  const buffer =
    await workbook.xlsx.writeBuffer();

  const safeFileName =
    `registrations-${activity.id}.xlsx`;

  return new Response(
    Buffer.from(buffer),
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition":
          `attachment; filename="${safeFileName}"`,

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}