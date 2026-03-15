import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBeforeAfterPhotos } from "@/lib/services/release";
import { SERVICE_WARRANTY_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import QRCode from "qrcode";
import ReportClient from "./report-client";

export default async function CompletionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch release record with full data
  const release = await prisma.releaseRecord.findFirst({
    where: { jobOrder: { id, deletedAt: null }, deletedAt: null },
    include: {
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
          estimates: {
            include: {
              estimateRequest: { select: { requestedCategories: true } },
              versions: {
                orderBy: { versionNumber: "desc" as const },
                take: 1,
                include: {
                  lineItems: {
                    where: { deletedAt: null },
                    orderBy: { sortOrder: "asc" as const },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!release) return notFound();

  // Before/after photos
  const photoData = await getBeforeAfterPhotos(id);

  // Warranties
  const warranties = await prisma.warranty.findMany({
    where: { jobOrderId: id, deletedAt: null },
    orderBy: { startDate: "asc" },
  });

  // Shop settings
  const shopSettings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "shop_name",
          "shop_address",
          "shop_phone",
          "shop_email",
          "shop_tin",
          "shop_logo_url",
        ],
      },
    },
  });
  const shopInfo = Object.fromEntries(
    shopSettings.map((s) => [s.key, s.value])
  );

  // Care instructions
  const careSettings = await prisma.setting.findMany({
    where: { key: { startsWith: "care_instructions_" } },
  });
  const careInstructions = Object.fromEntries(
    careSettings.map((s) => [s.key, s.value])
  );

  // Extract service categories from estimates
  const serviceCategories: string[] = [];
  for (const est of release.jobOrder.estimates) {
    if (est.estimateRequest?.requestedCategories) {
      const cats =
        typeof est.estimateRequest.requestedCategories === "string"
          ? JSON.parse(est.estimateRequest.requestedCategories)
          : est.estimateRequest.requestedCategories;
      if (Array.isArray(cats)) {
        cats.forEach((c: string) => {
          if (!serviceCategories.includes(c)) serviceCategories.push(c);
        });
      }
    }
  }

  // Generate QR code for the public completion report link
  const publicUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/view/report/${release.completionReportToken}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 150, margin: 1 });
  } catch {
    /* QR generation failed, skip */
  }

  // Get technicians who worked on this job
  const technicians = await prisma.task.findMany({
    where: {
      jobOrderId: id,
      deletedAt: null,
      assignedTechnicianId: { not: null },
    },
    select: {
      assignedTechnician: {
        select: { firstName: true, lastName: true },
      },
    },
    distinct: ["assignedTechnicianId"],
  });

  // Collect all line items across estimates for scope of work
  const allLineItems: Array<{
    group: string;
    description: string;
    quantity: number;
    unit: string;
  }> = [];
  for (const est of release.jobOrder.estimates) {
    const latestVersion = est.versions[0];
    if (latestVersion) {
      for (const li of latestVersion.lineItems) {
        allLineItems.push({
          group: li.group,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
        });
      }
    }
  }

  return (
    <div>
      <ReportClient />
      {/* Printable report content */}
      <div className="max-w-[210mm] mx-auto bg-white print:max-w-none">
        {/* ===== PAGE 1: COVER ===== */}
        <div className="p-12 text-center page-break-after">
          {shopInfo.shop_logo_url && (
            <img
              src={shopInfo.shop_logo_url}
              alt="Shop Logo"
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-primary mb-1">
            {shopInfo.shop_name || "AutoServ Pro"}
          </h1>
          <p className="text-sm text-surface-500">{shopInfo.shop_address}</p>
          <p className="text-sm text-surface-500">
            {shopInfo.shop_phone}
            {shopInfo.shop_email && ` \u2022 ${shopInfo.shop_email}`}
          </p>
          {shopInfo.shop_tin && (
            <p className="text-xs text-surface-400">
              TIN: {shopInfo.shop_tin}
            </p>
          )}

          <div className="mt-16 mb-16">
            <h2 className="text-3xl font-light text-primary tracking-wide">
              VEHICLE SERVICE
              <br />
              COMPLETION REPORT
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <p>
              <span className="text-surface-500">Vehicle:</span>{" "}
              <span className="font-medium">
                {[
                  release.jobOrder.vehicle.year,
                  release.jobOrder.vehicle.make,
                  release.jobOrder.vehicle.model,
                ]
                  .filter(Boolean)
                  .join(" ")}{" "}
                &mdash; {release.jobOrder.vehicle.plateNumber}
              </span>
            </p>
            <p>
              <span className="text-surface-500">Color:</span>{" "}
              <span className="font-medium">
                {release.jobOrder.vehicle.color}
              </span>
            </p>
            <p>
              <span className="text-surface-500">Customer:</span>{" "}
              <span className="font-medium">
                {release.jobOrder.customer.firstName}{" "}
                {release.jobOrder.customer.lastName}
              </span>
            </p>
            <p>
              <span className="text-surface-500">Job Order:</span>{" "}
              <span className="font-medium">
                {release.jobOrder.jobOrderNumber}
              </span>
            </p>
            <p>
              <span className="text-surface-500">Service Period:</span>{" "}
              <span className="font-medium">
                {formatDate(release.jobOrder.createdAt)} &rarr;{" "}
                {formatDate(release.releaseDate)}
              </span>
            </p>
          </div>
        </div>

        {/* ===== PAGE 2: SCOPE OF WORK ===== */}
        <div className="p-12 page-break-after">
          <h2 className="text-xl font-bold text-primary border-b-2 border-accent pb-2 mb-6">
            SCOPE OF WORK
          </h2>
          <div className="space-y-4">
            {serviceCategories.map((cat) => {
              const config =
                SERVICE_WARRANTY_MAP[
                  cat as keyof typeof SERVICE_WARRANTY_MAP
                ];
              // Filter line items that belong to LABOR group for this category
              return (
                <div key={cat} className="border-l-4 border-accent-200 pl-4">
                  <h3 className="font-semibold text-primary">
                    {config?.label || cat}
                  </h3>
                  {allLineItems.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {allLineItems.map((li, idx) => (
                        <li key={idx} className="text-sm text-surface-600">
                          {li.description}
                          {li.quantity > 1 &&
                            ` (${li.quantity} ${li.unit})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {serviceCategories.length === 0 && allLineItems.length > 0 && (
              <div className="border-l-4 border-accent-200 pl-4">
                <h3 className="font-semibold text-primary">Services</h3>
                <ul className="mt-2 space-y-1">
                  {allLineItems.map((li, idx) => (
                    <li key={idx} className="text-sm text-surface-600">
                      {li.description}
                      {li.quantity > 1 && ` (${li.quantity} ${li.unit})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {technicians.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Performed By
              </h3>
              <p className="text-sm text-primary">
                {technicians
                  .map((t) =>
                    t.assignedTechnician
                      ? `${t.assignedTechnician.firstName} ${t.assignedTechnician.lastName}`
                      : ""
                  )
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* ===== PAGE 3+: BEFORE & AFTER ===== */}
        {photoData.pairs.filter((p) => p.intake && p.release).length > 0 && (
          <div className="p-12 page-break-after">
            <h2 className="text-xl font-bold text-primary border-b-2 border-accent pb-2 mb-6">
              BEFORE &amp; AFTER
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {photoData.pairs
                .filter((p) => p.intake && p.release)
                .map((pair) => (
                  <div
                    key={pair.angle}
                    className="col-span-2 grid grid-cols-2 gap-3 mb-4"
                  >
                    <div>
                      <p className="text-xs text-surface-500 uppercase mb-1">
                        Before &mdash; {pair.label}
                      </p>
                      <img
                        src={pair.intake!.fullSizePath}
                        className="w-full rounded"
                        alt={`Before ${pair.label}`}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 uppercase mb-1">
                        After &mdash; {pair.label}
                      </p>
                      <img
                        src={pair.release!.fullSizePath}
                        className="w-full rounded"
                        alt={`After ${pair.label}`}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== FINAL PAGE: WARRANTY & CARE ===== */}
        <div className="p-12">
          {warranties.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-primary border-b-2 border-accent pb-2 mb-6">
                WARRANTY INFORMATION
              </h2>
              <div className="space-y-4 mb-8">
                {warranties.map((w) => (
                  <div
                    key={w.id}
                    className="border border-surface-200 rounded-lg p-4"
                  >
                    <h3 className="font-semibold text-primary">
                      {w.description}
                    </h3>
                    <p className="text-sm text-surface-500 mt-1">
                      {formatDate(w.startDate)} &mdash;{" "}
                      {formatDate(w.endDate)}
                    </p>
                    {w.terms && (
                      <p className="text-xs text-surface-400 mt-2">
                        {w.terms}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {serviceCategories.some((cat) => {
            const config =
              SERVICE_WARRANTY_MAP[
                cat as keyof typeof SERVICE_WARRANTY_MAP
              ];
            return config && careInstructions[config.careKey];
          }) && (
            <>
              <h2 className="text-xl font-bold text-primary border-b-2 border-accent pb-2 mb-6">
                CARE INSTRUCTIONS
              </h2>
              <div className="space-y-3 mb-8">
                {serviceCategories.map((cat) => {
                  const config =
                    SERVICE_WARRANTY_MAP[
                      cat as keyof typeof SERVICE_WARRANTY_MAP
                    ];
                  if (!config) return null;
                  const instructions = careInstructions[config.careKey];
                  if (!instructions) return null;
                  return (
                    <div key={cat} className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-700">
                        {config.label}
                      </h3>
                      <p className="text-sm text-blue-600 mt-1">
                        {instructions}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-surface-200 flex items-end justify-between">
            <div>
              <p className="text-sm text-surface-500">
                For warranty claims or questions:
              </p>
              {shopInfo.shop_phone && (
                <p className="text-sm font-medium">{shopInfo.shop_phone}</p>
              )}
              {shopInfo.shop_address && (
                <p className="text-sm">{shopInfo.shop_address}</p>
              )}
            </div>
            {qrDataUrl && (
              <div className="text-center">
                <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
                <p className="text-[10px] text-surface-400 mt-1">
                  Scan for digital version
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 15mm; }
              .no-print { display: none !important; }
              .page-break-after { page-break-after: always; }
              nav, aside, header, [data-sidebar], [data-topbar] { display: none !important; }
              main { padding: 0 !important; margin: 0 !important; }
              body { background: white !important; }
            }
          `,
        }}
      />
    </div>
  );
}
